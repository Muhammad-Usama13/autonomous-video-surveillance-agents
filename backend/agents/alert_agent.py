"""
agents/alert_agent.py – Dispatches alerts through configured channels.

Improvement over doc: adds rate-limiting so repeated alerts for the
same event type don't spam operators within a cooldown window.
"""
from __future__ import annotations
import smtplib
import asyncio
from email.mime.text import MIMEText
from datetime import datetime, timedelta
from typing import Dict
import json

from core.config import settings
from core.schemas import Incident


class AlertAgent:
    """
    Manages alert dispatch.

    Channels:
    - WebSocket push (real-time dashboard update)
    - Email (SMTP)

    Rate limiting: same event_type won't re-alert within COOLDOWN_SECONDS.
    """

    COOLDOWN_SECONDS = 60   # minimum gap between same-type alerts

    def __init__(self):
        self._last_alert: Dict[str, datetime] = {}
        self._ws_connections: list = []   # populated by the WS endpoint

    # ── WebSocket management ──────────────────────────────────────────────

    def register_ws(self, ws):
        self._ws_connections.append(ws)

    def unregister_ws(self, ws):
        self._ws_connections = [c for c in self._ws_connections if c is not ws]

    async def push_ws(self, message: dict):
        dead = []
        for ws in self._ws_connections:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.unregister_ws(ws)

    # ── Public API ────────────────────────────────────────────────────────

    async def dispatch(self, incident: Incident, channels: list[str] = None) -> bool:
        """
        Dispatches an alert for the incident.
        Returns True if at least one channel fired (respecting rate limit).
        """
        channels = channels or ["dashboard"]
        event_type = incident.event_type

        # Rate-limit check
        last = self._last_alert.get(event_type)
        if last and datetime.utcnow() - last < timedelta(seconds=self.COOLDOWN_SECONDS):
            return False

        self._last_alert[event_type] = datetime.utcnow()
        fired = False

        if "dashboard" in channels:
            await self.push_ws({
                "type": "incident",
                "data": {
                    "session_id":  incident.session_id,
                    "event_type":  incident.event_type,
                    "severity":    incident.severity,
                    "confidence":  incident.confidence,
                    "timestamp":   incident.timestamp,
                    "description": incident.description,
                }
            })
            fired = True

        if "email" in channels and settings.SMTP_USER and settings.ALERT_EMAIL:
            try:
                await asyncio.get_event_loop().run_in_executor(
                    None, self._send_email, incident
                )
                fired = True
            except Exception as e:
                print(f"[AlertAgent] Email failed: {e}")

        return fired

    # ── Email ─────────────────────────────────────────────────────────────

    def _send_email(self, incident: Incident):
        subject = f"[ALERT][{incident.severity.upper()}] {incident.event_type.replace('_', ' ').title()}"
        body = (
            f"Security Incident Detected\n"
            f"{'='*40}\n"
            f"Session  : {incident.session_id}\n"
            f"Time     : {incident.timestamp}\n"
            f"Event    : {incident.event_type}\n"
            f"Severity : {incident.severity}\n"
            f"Confidence: {incident.confidence:.1%}\n\n"
            f"Description:\n{incident.description}\n"
        )
        msg = MIMEText(body)
        msg["Subject"] = subject
        msg["From"]    = settings.SMTP_USER
        msg["To"]      = settings.ALERT_EMAIL

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as s:
            s.starttls()
            s.login(settings.SMTP_USER, settings.SMTP_PASS)
            s.send_message(msg)
