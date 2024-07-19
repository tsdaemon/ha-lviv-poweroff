[![SWUbanner](https://raw.githubusercontent.com/vshymanskyy/StandWithUkraine/main/banner-direct-single.svg)](https://stand-with-ukraine.pp.ua/)

![HA Lviv PowerOff Logo](./icons/icon.png)

# ⚡️ Home Assistant Lviv PowerOff

An integration for electricity shutdowns in  [LvivOblEnergo](lvivoblenergo). Based on data from [EnergyUA][energyua].

This integration for [Home Assistant][home-assistant] provides information about planned electricity shutdowns by [LvivOblEnergo](lvivoblenergo) in Lvivska oblast:
calendar of planned shutdowns, time sensors for the next planned power on and off events. It is based on messages posted by a community
driven project [EnergyUA][energyua].

**💡 Note:** This is not affiliated with [EnergyUA][energyua] or [LvivOblEnergo](lvivoblenergo) in any way. This integration is developed by an individual.
Provided data may be incorrect or misleading, follow the official channels for reliable information.

> This integration is inspired by [ha-yasno-outages](https://github.com/denysdovhan/ha-yasno-outages) by [Denys Dovhan](https://github.com/denysdovhan).

## Installation

The quickest way to install this integration is via [HACS][hacs-url] by clicking the button below:

[![Add to HACS via My Home Assistant][hacs-install-image]][hasc-install-url]

If it doesn't work, adding this repository to HACS manually by adding this URL:

1. Visit **HACS** → **Integrations** → **...** (in the top right) → **Custom repositories**
1. Click **Add**
1. Paste `https://github.com/tsdaemon/ha-lviv-poweroff` into the **URL** field
1. Chose **Integration** as a **Category**
1. **Lviv PowerOff** will appear in the list of available integrations. Install it normally.

## Usage

This integration is configurable via UI. On **Devices and Services** page, click **Add Integration** and search for **Lviv PowerOff**.

Find your group by visiting [EnergyUA][energyua] website and typing your address in the search bar. Select your group in the configuration.

Then you can add the integration to your dashboard and see the information about the next planned outages.



Integration also provides a calendar view of planned outages. You can add it to your dashboard as well via [Calendar card][calendar-card].

<!-- References -->

[energyua]: https://lviv.energy-ua.info/
[lvivoblenergo]: https://loe.lviv.ua/
[home-assistant]: https://www.home-assistant.io/
[hacs-url]: https://github.com/hacs/integration
[hasc-install-url]: https://my.home-assistant.io/redirect/hacs_repository/?owner=denysdovhan&repository=ha-yasno-outages&category=integration
[hacs-install-image]: https://my.home-assistant.io/badges/hacs_repository.svg
[add-translation]: https://github.com/denysdovhan/ha-yasno-outages/blob/master/contributing.md#how-to-add-translation
[calendar-card]: https://www.home-assistant.io/dashboards/calendar/
