"""Module for power off period entities."""

from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass
class PowerOffPeriod:
    """Class for power off period."""

    start: int
    end: int
    today: bool

    def to_datetime_period(self, tz_info) -> tuple[datetime, datetime]:
        """Convert Unix timestamps to datetime period."""
        start = datetime.fromtimestamp(self.start, tz=timezone.utc).astimezone(tz_info)
        end = datetime.fromtimestamp(self.end, tz=timezone.utc).astimezone(tz_info)
        return start, end
