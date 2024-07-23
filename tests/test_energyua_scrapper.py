from pathlib import Path

from aioresponses import aioresponses
import pytest

from lviv_poweroff.energyua_scrapper import EnergyUaScrapper
from lviv_poweroff.entities import PowerOffPeriod


def load_energyua_page(group: str):
    test_file = Path(__file__).parent / f"energyua_{group.replace(".", "")}_page.html"

    with open(test_file, encoding="utf-8") as file:
        return file.read()


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "group,expected_result",
    [
        (
            "1.2",
            [
                PowerOffPeriod(23, 0, today=True),
                PowerOffPeriod(0, 2, today=True),
                PowerOffPeriod(6, 8, today=True),
                PowerOffPeriod(11, 14, today=True),
                PowerOffPeriod(16, 20, today=True),
                PowerOffPeriod(22, 0, today=True),
                PowerOffPeriod(7, 9, today=False),
                PowerOffPeriod(19, 21, today=False),
            ],
        ),
        (
            "1.1",
            [
                PowerOffPeriod(0, 1, today=True),
                PowerOffPeriod(7, 9, today=True),
                PowerOffPeriod(14, 15, today=True),
                PowerOffPeriod(19, 22, today=True),
            ],
        ),
    ],
)
async def test_energyua_scrapper(group, expected_result) -> None:
    # Given a response from the EnergyUa website
    with aioresponses() as mock:
        mock.get(f"https://lviv.energy-ua.info/grupa/{group}", body=load_energyua_page(group))
        # When scrapper is called for power-off periods
        scrapper = EnergyUaScrapper(group)
        poweroffs = await scrapper.get_power_off_periods()

    # Then the power-off periods are extracted correctly
    assert poweroffs is not None
    assert len(poweroffs) == len(expected_result)
    assert poweroffs == expected_result
