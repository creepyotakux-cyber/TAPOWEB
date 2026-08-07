import subprocess
import shutil
import time
import re
import threading
import datetime
import logging
import os
from pathlib import Path
from backend.config import RECORDINGS_DIR, TIMEZONE

logger = logging.getLogger("recording_service")


SEGMENT_PATTERN = re.compile(r"^(\d{4})(\d{2})(\d{2})_(\d{2})\.mp4$")
BACKUP_PATTERN = re.compile(r"^(\d{4})(\d{2})(\d{2})_(\d{2})\.mp4\.backup_\d{6}$")
LEGACY_PATTERN = re.compile(r"^(.+)_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.mp4$")


class RecordingService:
    def __init__(self):
        self._processes: dict[str, subprocess.Popen] = {}
        self._paths: dict[str, str] = {}
        self._names: dict[str, str] = {}
        self._last_backup: dict[str, Path] = {}
        self._cleanup_stop: threading.Event | None = None
        self._cleanup_thread: threading.Thread | None = None

    def kill_orphans(self) -> int:
        """Kill all ffmpeg processes that are writing DVR segments.
        Called on startup to clean up processes from a previous run."""
        killed = 0
        try:
            import psutil
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info.get('cmdline') or []
                    if len(cmdline) < 3:
                        continue
                    # Detect: ffmpeg ... -f segment ... %Y%m%d_%H.mp4
                    if '-f' in cmdline and 'segment' in cmdline and any(
                        '%Y%m%d_%H.mp4' in arg for arg in cmdline
                    ):
                        proc.kill()
                        killed += 1
                        logger.info("Killed orphan ffmpeg PID %s", proc.info['pid'])
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except ImportError:
            pass
        return killed

    def _resolve_ffmpeg(self) -> str:
        exe = shutil.which("ffmpeg")
        if exe:
            return exe
        try:
            import imageio_ffmpeg
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            return "ffmpeg"

    def _resolve_ffprobe(self) -> str | None:
        exe = shutil.which("ffprobe")
        if exe:
            return exe
        # Try alongside ffmpeg
        ffmpeg = shutil.which("ffmpeg")
        if ffmpeg:
            candidate = Path(ffmpeg).parent / "ffprobe.exe"
            if candidate.exists():
                return str(candidate)
            candidate = Path(ffmpeg).parent / "ffprobe"
            if candidate.exists():
                return str(candidate)
        return None

    def _camera_dir(self, camera_id: str) -> Path:
        return RECORDINGS_DIR / f"cam_{camera_id}"

    def _ensure_dir(self, camera_id: str) -> Path:
        d = self._camera_dir(camera_id)
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _date_folder(self, dt: datetime.datetime) -> str:
        return dt.strftime("%d_%m_%Y")

    def _current_date_folder(self) -> str:
        return self._date_folder(datetime.datetime.now(TIMEZONE))

    def _tomorrow_date_folder(self) -> str:
        return self._date_folder(datetime.datetime.now(TIMEZONE) + datetime.timedelta(days=1))

    def _ensure_date_dirs(self, camera_id: str) -> None:
        d = self._camera_dir(camera_id)
        for folder in (self._current_date_folder(), self._tomorrow_date_folder()):
            (d / folder).mkdir(parents=True, exist_ok=True)

    def migrate_flat_segments(self) -> int:
        moved = 0
        for cam_dir in RECORDINGS_DIR.glob("cam_*"):
            if not cam_dir.is_dir():
                continue
            for f in sorted(cam_dir.glob("*.mp4")):
                m = SEGMENT_PATTERN.match(f.name)
                if not m:
                    continue
                y, mo, d_str = m.group(1), m.group(2), m.group(3)
                folder_name = f"{d_str}_{mo}_{y}"
                target_dir = cam_dir / folder_name
                target_dir.mkdir(parents=True, exist_ok=True)
                target = target_dir / f.name
                try:
                    f.rename(target)
                    moved += 1
                except OSError as e:
                    logger.warning("Migration: failed to move %s: %s", f, e)
            for f in sorted(cam_dir.glob("*.mp4.backup_*")):
                base = f.name.split(".backup_")[0]
                m = SEGMENT_PATTERN.match(base)
                if not m:
                    continue
                y, mo, d_str = m.group(1), m.group(2), m.group(3)
                folder_name = f"{d_str}_{mo}_{y}"
                target_dir = cam_dir / folder_name
                target_dir.mkdir(parents=True, exist_ok=True)
                target = target_dir / f.name
                try:
                    f.rename(target)
                    moved += 1
                except OSError:
                    pass
        if moved:
            logger.info("Migration: moved %d flat segments into date folders", moved)
        return moved

    def _delete_stale_current_segment(self, camera_id: str) -> None:
        """Remove the file for the current local hour if it is 0 bytes or was
        last modified >60 s ago (likely a stuck/partial segment from a prior
        ffmpeg that died without flushing its moov atom). FFmpeg's segment
        muxer refuses to overwrite a partially-written file cleanly on
        Windows, so we delete it so the next ffmpeg starts fresh."""
        try:
            d = self._camera_dir(camera_id) / self._current_date_folder()
            if not d.exists():
                return
            name = datetime.datetime.now(TIMEZONE).strftime("%Y%m%d_%H.mp4")
            f = d / name
            if not f.exists():
                d = self._camera_dir(camera_id)  # legacy flat fallback
                f = d / name
            if not f.exists():
                return
            try:
                stat = f.stat()
            except OSError:
                return
            if stat.st_size == 0:
                logger.info("Camera %s: removing empty current segment %s", camera_id, name)
                f.unlink(missing_ok=True)
                return
            age = time.time() - stat.st_mtime
            if age > 60:
                logger.warning(
                    "Camera %s: removing stale current segment %s (size=%d, age=%ds)",
                    camera_id, name, stat.st_size, int(age),
                )
                f.unlink(missing_ok=True)
        except OSError:
            pass

    def _cleanup_broken_segments(self, camera_id: str) -> int:
        """Remove MP4 files from previous hours that lack a valid moov atom.
        These are orphaned by unclean ffmpeg shutdowns and cannot be played."""
        d = self._camera_dir(camera_id)
        if not d.exists():
            return 0
        current_name = datetime.datetime.now(TIMEZONE).strftime("%Y%m%d_%H.mp4")
        deleted = 0
        for f in list(d.glob("*/*.mp4")) + list(d.glob("*.mp4")) + list(d.glob("*/*.mp4.backup_*")) + list(d.glob("*.mp4.backup_*")):
            if not (SEGMENT_PATTERN.match(f.name) or BACKUP_PATTERN.match(f.name)):
                continue
            if f.name == current_name:
                continue
            try:
                if f.stat().st_size < self.MIN_PLAYABLE_SIZE:
                    f.unlink(missing_ok=True)
                    deleted += 1
                    continue
                if self._has_valid_moov(f) is False:
                    logger.warning("Camera %s: removing broken segment %s (no moov atom)", camera_id, f.name)
                    f.unlink(missing_ok=True)
                    deleted += 1
            except OSError:
                pass
        if deleted:
            logger.info("Camera %s: cleaned up %d broken segment(s)", camera_id, deleted)
        return deleted

    def restore_all_backups(self) -> int:
        restored = 0
        for cam_dir in sorted(RECORDINGS_DIR.glob("cam_*")):
            if not cam_dir.is_dir():
                continue
            for date_dir in sorted(cam_dir.glob("*")):
                if not date_dir.is_dir() or date_dir.name in ("_live", "_pause", "_prepare") or date_dir.name.startswith("_"):
                    continue
                groups: dict[str, list[Path]] = {}
                for f in date_dir.glob("*.mp4.backup_*"):
                    if not BACKUP_PATTERN.match(f.name):
                        continue
                    base = f.name.split(".backup_")[0]
                    if base not in groups:
                        groups[base] = []
                    groups[base].append(f)
                for base, files in groups.items():
                    target = date_dir / base
                    if target.exists():
                        continue
                    best = max(files, key=lambda x: x.stat().st_size)
                    try:
                        best.rename(target)
                        restored += 1
                        logger.info("Restored backup %s -> %s", best, target.relative_to(RECORDINGS_DIR))
                        for other in files:
                            if other != best and other.exists():
                                other.unlink(missing_ok=True)
                    except OSError as e:
                        logger.warning("Failed to restore backup %s: %s", best, e)
            for f in sorted(cam_dir.glob("*.mp4.backup_*")):
                if not BACKUP_PATTERN.match(f.name):
                    continue
                base = f.name.split(".backup_")[0]
                target = cam_dir / base
                if target.exists():
                    continue
                try:
                    f.rename(target)
                    restored += 1
                    logger.info("Restored backup %s -> %s", f, target.relative_to(RECORDINGS_DIR))
                except OSError as e:
                    logger.warning("Failed to restore backup %s: %s", f, e)
        if restored:
            logger.info("Restored %d backup files to .mp4 recordings", restored)
        return restored

    def start(self, camera_id: str, rtsp_url: str, camera_name: str = "cam") -> dict:
        if camera_id in self._processes:
            proc = self._processes[camera_id]
            if proc.poll() is None:
                return {"success": True, "already_running": True, "message": "DVR recording already active"}

        self._names[camera_id] = camera_name
        self._cleanup_broken_segments(camera_id)
        self._ensure_date_dirs(camera_id)

        out_dir = self._ensure_dir(camera_id)
        now = datetime.datetime.now(TIMEZONE)
        current_name = now.strftime("%Y%m%d_%H.mp4")
        date_folder = self._date_folder(now)
        current_file = out_dir / date_folder / current_name
        if current_file.exists() and current_file.stat().st_size > 0:
            backup_name = f"{current_name}.backup_{now.strftime('%H%M%S')}"
            backup_path = out_dir / date_folder / backup_name
            try:
                shutil.move(str(current_file), str(backup_path))
                self._last_backup[camera_id] = backup_path
                logger.warning("Camera %s: preserved existing segment as %s", camera_id, f"{date_folder}/{backup_name}")
            except OSError:
                pass

        self._delete_stale_current_segment(camera_id)

        live_dir = out_dir / "_live"
        live_dir.mkdir(parents=True, exist_ok=True)
        for old in live_dir.glob("*.ts"):
            old.unlink(missing_ok=True)
        pl = live_dir / "playlist.m3u8"
        pl.unlink(missing_ok=True)

        ffmpeg = self._resolve_ffmpeg()
        seg_path = str(out_dir / "%d_%m_%Y" / "%Y%m%d_%H.mp4")
        hls_seg_pattern = str(live_dir / "seg_%05d.ts")
        hls_playlist = str(pl)

        creation = datetime.datetime.now(TIMEZONE).strftime("%Y-%m-%dT%H:%M:%S-04:00")

        cmd = [
            ffmpeg, "-y",
            "-rtsp_transport", "tcp",
            "-timeout", "15000000",
            "-fflags", "+genpts",
            "-i", rtsp_url,
            "-map", "0:v",
            "-map", "0:a?",
            "-max_muxing_queue_size", "1024",
            "-c:v", "copy",
            "-c:a", "copy",
            "-f", "segment",
            "-segment_time", "3600",
            "-segment_format", "mp4",
            "-strftime", "1",
            "-reset_timestamps", "1",
            "-segment_atclocktime", "1",
            "-segment_start_number", "0",
            "-segment_format_options", "movflags=+frag_keyframe+empty_moov+default_base_moof",
            "-metadata", f"creation_time={creation}",
            seg_path,
            "-c:v", "copy",
            "-c:a", "copy",
            "-f", "hls",
            "-hls_time", "2",
            "-hls_list_size", "3600",
            "-hls_flags", "delete_segments+append_list+omit_endlist",
            "-hls_segment_filename", hls_seg_pattern,
            hls_playlist,
        ]

        try:
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                env={**os.environ, "TZ": "America/Caracas"},
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
            )
            t = threading.Thread(
                target=self._stderr_reader,
                args=(camera_id, proc),
                daemon=True,
                name=f"dvr-stderr-{camera_id}",
            )
            t.start()
            self._processes[camera_id] = proc
            self._paths[camera_id] = seg_path
            self._start_cleanup_loop()
            return {"success": True, "mode": "dvr", "directory": f"cam_{camera_id}", "segment_time": 3600}
        except Exception as e:
            self._restore_backup(camera_id)
            return {"success": False, "error": str(e)}

    def _stderr_reader(self, camera_id: str, proc: subprocess.Popen):
        try:
            for raw in iter(proc.stderr.readline, b""):
                line = raw.decode("utf-8", "replace").rstrip()
                if not line:
                    continue
                low = line.lower()
                if any(k in low for k in ("error", "denied", "401", "403", "refused", "timed out", "unauthorized", "not permitted")):
                    logger.warning("Camera %s DVR: %s", camera_id, line)
                if "error opening input" in low or "no route to host" in low or "connection refused" in low:
                    self._restore_backup(camera_id)
        except Exception:
            pass
        finally:
            if proc is not None and proc.poll() is not None:
                self._restore_backup(camera_id)

    def _restore_backup(self, camera_id: str):
        out_dir = self._camera_dir(camera_id)
        now = datetime.datetime.now(TIMEZONE)
        current_name = now.strftime("%Y%m%d_%H.mp4")
        date_folder = self._date_folder(now)
        current_file = out_dir / date_folder / current_name
        best: tuple[int, Path | None] = (0, None)
        for f in out_dir.glob(f"{date_folder}/{current_name}.backup_*"):
            try:
                sz = f.stat().st_size
                if sz > best[0]:
                    best = (sz, f)
            except OSError:
                pass
        if best[1] is None:
            return
        try:
            if current_file.exists() and current_file.stat().st_size >= best[0]:
                return
            shutil.copy2(str(best[1]), str(current_file))
            self._last_backup[camera_id] = best[1]
            logger.warning("Camera %s: restored backup (%dMB) after connection failure", camera_id, best[0] // (1024 * 1024))
        except OSError:
            pass

    def _in_progress_filename(self, camera_id: str) -> str | None:
        """Return the filename of the segment currently being written by FFmpeg,
        or None if the camera is not recording right now. The DVR writes
        ``%Y%m%d_%H.mp4`` in the camera directory; the file at this exact
        local hour is the one FFmpeg still holds open (moov atom not flushed
        yet, so browsers cannot stream it)."""
        proc = self._processes.get(camera_id)
        if proc is None or proc.poll() is not None:
            return None
        return datetime.datetime.now(TIMEZONE).strftime("%Y%m%d_%H.mp4")

    def _iter_segment_files(self, camera_id: str, skip_in_progress: bool = False):
        d = self._camera_dir(camera_id)
        if not d.exists():
            return []
        skip_name = self._in_progress_filename(camera_id) if skip_in_progress else None
        out = []
        seen = set()
        for f in d.glob("*/*.mp4"):
            if SEGMENT_PATTERN.match(f.name):
                if skip_name and f.name == skip_name:
                    continue
                out.append(f)
                seen.add(f.name)
        for f in d.glob("*.mp4"):
            if SEGMENT_PATTERN.match(f.name):
                if skip_name and f.name == skip_name:
                    continue
                out.append(f)
                seen.add(f.name)
        for f in d.glob("*/*.mp4.backup_*"):
            m = BACKUP_PATTERN.match(f.name)
            if not m:
                continue
            base = f.name.split(".backup_")[0]
            if base in seen:
                continue
            out.append(f)
            seen.add(f.name)
        for f in d.glob("*.mp4.backup_*"):
            m = BACKUP_PATTERN.match(f.name)
            if not m:
                continue
            base = f.name.split(".backup_")[0]
            if base in seen:
                continue
            out.append(f)
            seen.add(f.name)
        return out

    def stop(self, camera_id: str) -> dict:
        proc = self._processes.pop(camera_id, None)
        path = self._paths.pop(camera_id, None)
        self._names.pop(camera_id, None)
        self._last_backup.pop(camera_id, None)
        if proc is None:
            return {"success": False, "error": "not recording"}
        try:
            if proc.stdin:
                try:
                    proc.stdin.write(b"q")
                    proc.stdin.flush()
                except Exception:
                    pass
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    proc.terminate()
                except Exception:
                    pass
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=2)
        except Exception:
            pass
        live_dir = self._camera_dir(camera_id) / "_live"
        try:
            for f in live_dir.glob("*.ts"):
                f.unlink(missing_ok=True)
            pl = live_dir / "playlist.m3u8"
            pl.unlink(missing_ok=True)
        except Exception:
            pass
        return {"success": True, "file": path}

    def stop_all(self):
        for cid in list(self._processes.keys()):
            try:
                self.stop(cid)
            except Exception:
                pass
        if self._cleanup_thread is not None and self._cleanup_stop is not None:
            self._cleanup_stop.set()

    def is_recording(self, camera_id: str) -> bool:
        proc = self._processes.get(camera_id)
        return proc is not None and proc.poll() is None

    def list_recordings(self) -> list[dict]:
        recordings: list[dict] = []

        for cam_dir in RECORDINGS_DIR.glob("cam_*"):
            if not cam_dir.is_dir():
                continue
            cam_id = cam_dir.name.removeprefix("cam_")
            for f in self._iter_segment_files(cam_id, skip_in_progress=True):
                m = SEGMENT_PATTERN.match(f.name) or BACKUP_PATTERN.match(f.name)
                if not m:
                    continue
                stat = f.stat()
                date_str = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
                hour = int(m.group(4))
                recordings.append({
                    "filename": str(f.relative_to(RECORDINGS_DIR)).replace("\\", "/"),
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "camera_id": cam_id,
                    "date": date_str,
                    "hour": hour,
                    "type": "dvr",
                })

        for f in RECORDINGS_DIR.glob("*.mp4"):
            if f.parent != RECORDINGS_DIR:
                continue
            stat = f.stat()
            recordings.append({
                "filename": f.name,
                "size": stat.st_size,
                "modified": stat.st_mtime,
                "camera_id": None,
                "date": None,
                "hour": None,
                "type": "manual",
            })

        recordings.sort(key=lambda r: r["modified"], reverse=True)
        return recordings

    def get_calendar(self, camera_id: str) -> list[dict]:
        by_date: dict[str, dict] = {}
        for f in self._iter_segment_files(camera_id, skip_in_progress=False):
            m = SEGMENT_PATTERN.match(f.name) or BACKUP_PATTERN.match(f.name)
            if not m:
                continue
            date_str = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
            entry = by_date.setdefault(date_str, {"date": date_str, "count": 0, "total_size": 0, "hours": []})
            entry["count"] += 1
            entry["total_size"] += f.stat().st_size
            entry["hours"].append(int(m.group(4)))
        result = sorted(by_date.values(), key=lambda x: x["date"], reverse=True)
        for e in result:
            e["hours"].sort()
        return result

    MIN_PLAYABLE_SIZE = 10240  # 10 KB — segments smaller than this are incomplete

    def _ffprobe(self, filepath: Path, entries: str, extra_args: list[str] | None = None) -> str:
        ffprobe = self._resolve_ffprobe()
        if not ffprobe:
            return ""
        try:
            cmd = [ffprobe, "-v", "error"]
            if extra_args:
                cmd.extend(extra_args)
            cmd.extend(["-show_entries", entries, "-of", "csv=p=0", str(filepath)])
            result = subprocess.run(
                cmd, capture_output=True, timeout=30,
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
            )
            return result.stdout.decode("utf-8", "replace").strip()
        except subprocess.TimeoutExpired:
            logger.warning("ffprobe timeout (%ds) for %s", 30, filepath.name)
            return ""
        except Exception:
            return ""

    def _has_valid_moov(self, filepath: Path) -> bool | None:
        output = self._ffprobe(filepath, "stream=codec_type")
        if len(output) > 0:
            return True
        if filepath.stat().st_size >= self.MIN_PLAYABLE_SIZE:
            return None
        return False

    def _get_video_codec(self, filepath: Path) -> str:
        return self._ffprobe(filepath, "stream=codec_name", extra_args=["-select_streams", "v:0"])

    def is_segment_playable(self, camera_id: str, filename: str) -> tuple[bool, str]:
        """Check whether a DVR segment file is safe to play.
        Returns (playable, reason)."""
        p = (RECORDINGS_DIR / filename).resolve()
        try:
            p.relative_to(RECORDINGS_DIR.resolve())
        except ValueError:
            return False, "invalid path"
        if not p.exists() or not p.is_file():
            return False, "file not found"
        try:
            size = p.stat().st_size
        except OSError:
            return False, "stat failed"
        if size < self.MIN_PLAYABLE_SIZE:
            return False, "file too small (still recording)"
        is_in_progress = False
        skip_name = self._in_progress_filename(camera_id)
        if skip_name and p.name == skip_name:
            is_in_progress = True
        if self._has_valid_moov(p) is False:
            if is_in_progress:
                return False, "segment in progress (moov not ready)"
            return False, "invalid mp4 (moov atom missing)"
        codec = self._get_video_codec(p)
        if codec and codec not in ("h264", "mpeg4", "vp8", "vp9", "av1"):
            return False, f"codec '{codec}' no soportado por el navegador"
        if is_in_progress:
            return True, "in progress"
        return True, "ok"

    def get_hours(self, camera_id: str, date_str: str) -> list[dict]:
        parts = date_str.split("-")
        if len(parts) != 3:
            return []
        y, mo, d_str = int(parts[0]), int(parts[1]), int(parts[2])
        ymd = f"{y:04d}{mo:02d}{d_str:02d}"
        folder_name = f"{d_str:02d}_{mo:02d}_{y:04d}"
        cam_dir = self._camera_dir(camera_id)
        skip_name = self._in_progress_filename(camera_id)
        hours: list[dict] = []
        date_dir = cam_dir / folder_name
        files_to_check: list[Path] = list(date_dir.glob("*.mp4")) if date_dir.exists() else []
        files_to_check.extend(date_dir.glob("*.mp4.backup_*") if date_dir.exists() else [])
        if cam_dir.exists():
            files_to_check.extend(cam_dir.glob(f"{ymd}_*.mp4"))
            files_to_check.extend(cam_dir.glob(f"{ymd}_*.mp4.backup_*"))
        for f in files_to_check:
            m = SEGMENT_PATTERN.match(f.name) or BACKUP_PATTERN.match(f.name)
            if not m:
                continue
            hour = int(m.group(4))
            is_backup = ".backup_" in f.name
            if is_backup:
                existing = next((h for h in hours if h["hour"] == hour and ".backup_" not in h.get("filename", "")), None)
                if existing:
                    continue
            is_in_progress = False
            stat = f.stat()
            playable_base = stat.st_size >= self.MIN_PLAYABLE_SIZE and self._has_valid_moov(f) is not False
            codec_ok = True
            if playable_base:
                codec = self._get_video_codec(f)
                codec_ok = (not codec) or codec in ("h264", "mpeg4", "vp8", "vp9", "av1")
            playable = playable_base and codec_ok
            hours.append({
                "hour": hour,
                "filename": str(f.relative_to(RECORDINGS_DIR)).replace("\\", "/"),
                "size": stat.st_size,
                "modified": stat.st_mtime,
                "playable": playable,
                "in_progress": is_in_progress,
            })
        hours.sort(key=lambda x: x["hour"])
        return hours

    def cleanup_old(self, retention_days: int) -> dict:
        if retention_days <= 0:
            return {"success": True, "deleted": 0, "message": "retention disabled"}
        cutoff = time.time() - retention_days * 86400
        deleted = 0
        freed = 0
        for cam_dir in RECORDINGS_DIR.glob("cam_*"):
            if not cam_dir.is_dir():
                continue
            for f in list(cam_dir.glob("*/*.mp4")) + list(cam_dir.glob("*.mp4")) + list(cam_dir.glob("*/*.mp4.backup_*")) + list(cam_dir.glob("*.mp4.backup_*")):
                if not (SEGMENT_PATTERN.match(f.name) or BACKUP_PATTERN.match(f.name)):
                    continue
                try:
                    stat = f.stat()
                except OSError:
                    continue
                if stat.st_mtime < cutoff:
                    try:
                        f.unlink()
                        deleted += 1
                        freed += stat.st_size
                    except OSError:
                        pass
            for date_dir in sorted(cam_dir.glob("*")):
                if not date_dir.is_dir():
                    continue
                if date_dir.name in ("_live", "_pause"):
                    continue
                if date_dir.name.startswith("_"):
                    continue
                try:
                    if not any(date_dir.iterdir()):
                        date_dir.rmdir()
                except OSError:
                    pass
        return {"success": True, "deleted": deleted, "freed_bytes": freed}

    def _start_cleanup_loop(self):
        if self._cleanup_thread is not None and self._cleanup_thread.is_alive():
            return
        self._cleanup_stop = threading.Event()
        self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleanup_thread.start()

    def _cleanup_loop(self):
        from backend.config import load_settings
        stop = self._cleanup_stop
        if stop is None:
            return
        while not stop.wait(3600):
            try:
                settings = load_settings()
                retention = int(settings.get("recording_retention_days", 7))
                if retention > 0:
                    self.cleanup_old(retention)
                for cid in list(self._processes.keys()):
                    if self.is_recording(cid):
                        self._ensure_date_dirs(cid)
            except Exception:
                pass

    PREPARE_DIR_NAME = "_prepare"

    def _prepare_dir(self) -> Path:
        d = RECORDINGS_DIR / self.PREPARE_DIR_NAME
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _cleanup_prepare_dir(self):
        d = RECORDINGS_DIR / self.PREPARE_DIR_NAME
        if not d.exists():
            return
        cutoff = time.time() - 600
        for f in d.glob("*"):
            try:
                if f.stat().st_mtime < cutoff:
                    f.unlink(missing_ok=True)
            except OSError:
                pass

    def prepare_segment(self, filename: str) -> tuple[Path | None, str]:
        p = (RECORDINGS_DIR / filename).resolve()
        try:
            p.relative_to(RECORDINGS_DIR.resolve())
        except ValueError:
            return None, "invalid path"
        if not p.exists() or not p.is_file():
            return None, "file not found"
        try:
            size = p.stat().st_size
        except OSError:
            return None, "stat failed"
        if size < self.MIN_PLAYABLE_SIZE:
            return None, "file too small"
        if self._has_valid_moov(p) is not False:
            return p, "already_ready"
        return None, "moov not ready"

    def get_recording_path(self, filename: str) -> Path | None:
        p = (RECORDINGS_DIR / filename).resolve()
        try:
            p.relative_to(RECORDINGS_DIR.resolve())
        except ValueError:
            return None
        if p.exists() and p.is_file():
            return p
        return None


recording_service = RecordingService()
