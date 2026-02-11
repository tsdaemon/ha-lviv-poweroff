"""Provides classes for scraping power off periods from the Energy UA website."""

import json
import re

import aiohttp

from .const import PowerOffGroup
from .entities import PowerOffPeriod

URL = "https://lviv.energy-ua.info/grupa/{}"
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"


class EnergyUaScrapper:
    """Class for scraping power off periods from the Energy UA website."""

    def __init__(self, group: PowerOffGroup) -> None:
        """Initialize the EnergyUaScrapper object."""
        self.group = group

    async def validate(self) -> bool:
        async with (
            aiohttp.ClientSession(headers={"User-Agent": USER_AGENT}) as session,
            session.get(URL.format(self.group)) as response,
        ):
            return response.status == 200

    @staticmethod
    def merge_periods(periods: list[PowerOffPeriod]) -> list[PowerOffPeriod]:
        if not periods:
            return []

        periods.sort(key=lambda x: x.start)

        merged_periods = [periods[0]]
        for current in periods[1:]:
            last = merged_periods[-1]
            if current.start <= last.end:  # Overlapping or contiguous periods
                last.end = max(last.end, current.end)
                continue
            merged_periods.append(current)

        return merged_periods

    async def get_power_off_periods(self) -> list[PowerOffPeriod]:
        async with (
            aiohttp.ClientSession(headers={"User-Agent": USER_AGENT}) as session,
            session.get(URL.format(self.group)) as response,
        ):
            content = await response.text()

            results = []

            # Extract today's periods from embedded JSON timestamps
            today_periods = self._extract_json_periods(content, "periods")
            for period in today_periods:
                if period.get("status") == "red":
                    results.append(PowerOffPeriod(
                        start=period["time_from"],
                        end=period["time_to"],
                        today=True,
                    ))

            # Extract tomorrow's periods from embedded JSON timestamps
            tomorrow_periods = self._extract_json_periods(content, "tomorrowPeriods")
            for period in tomorrow_periods:
                if period.get("status") == "red":
                    results.append(PowerOffPeriod(
                        start=period["time_from"],
                        end=period["time_to"],
                        today=False,
                    ))

            today_results = self.merge_periods(
                [p for p in results if p.today]
            )
            tomorrow_results = self.merge_periods(
                [p for p in results if not p.today]
            )

            return today_results + tomorrow_results

    @staticmethod
    def _extract_json_periods(content: str, var_name: str) -> list[dict]:
        """Extract JSON period data from embedded JavaScript."""
        if var_name == "tomorrowPeriods":
            pattern = r"const\s+tomorrowPeriods\s*=\s*Object\.values\(([\[\{].*?[\]\}])\)"
        else:
            pattern = r"const\s+" + var_name + r"\s*=\s*(\[.*?\])\s*;"

        match = re.search(pattern, content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except (json.JSONDecodeError, IndexError):
                return []
        return []
