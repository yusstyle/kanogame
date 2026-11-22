# Phase 7B Manual Test Guide

Use this guide to validate the Phase 7B city identity and travel flow in the running game. These steps require a person operating the visible browser. No live runtime result is implied by this document.

## Before starting

1. Open `http://localhost:5173` in an Edge or Chrome **InPrivate/Incognito** window. This keeps the test save separate from the normal browser profile.
2. Start the game and confirm the starting city is Kano.
3. Enter the sedan, note its condition, and record it below. The driver contact Garba in the in-game phone (P) reports the condition when it is below 80%; if the phone does not show a numeric value, record **not exposed in UI** rather than estimating.
4. Capture a genuine game screenshot as `phase7b_verified_screenshots/01-kano-before-travel.png`.

## Test A — Initial Kano state

- [ ] HUD reads **KANO / STREETS**.
- [ ] HUD location is a Kano district.
- [ ] Kano environment is visible.
- Initial sedan condition: ______ % / not exposed in UI

## Test B — Travel to Abuja

1. Press **M** to open the directory.
2. Select **Abuja FCT**.
3. Choose **Drive via Highway A2 (Free)**.
4. Confirm the Abuja environment appears, the HUD reads **ABUJA / STREETS**, and the location is the Abuja arrival district (the highway gateway for highway travel).
5. Capture immediately as `phase7b_verified_screenshots/02-abuja-arrival.png`.

- [ ] Active scene looks like Abuja.
- [ ] HUD reads ABUJA.
- [ ] District corresponds to the arrival location.
- [ ] Abuja welcome message appears.

## Test C — Welcome-message timeout

1. After arrival, wait about five seconds without pausing the game.
2. Confirm the Abuja welcome message disappears.
3. Capture as `phase7b_verified_screenshots/03-abuja-after-welcome.png`.

- [ ] Welcome message disappeared after about five seconds.
- [ ] HUD still reads ABUJA and the district remains an Abuja district.

## Test D — Return to Kano

1. Press **M** to open the directory.
2. Select **Kano State** and choose **Drive via Highway A2 (Free)**.
3. Confirm the Kano environment and HUD return, and that the district label is a Kano district rather than an Abuja label.
4. Capture as `phase7b_verified_screenshots/04-kano-after-return.png`.
5. Check that the test save still opens and the recorded vehicle condition is unchanged unless gameplay collisions occurred.

- [ ] Active scene looks like Kano.
- [ ] HUD reads KANO.
- [ ] Kano district is shown; no Abuja district label remains.
- [ ] Player/save state remains usable.
- [ ] Sedan condition: ______ % / not exposed in UI

## Test E — Gameplay observations

While in both cities, observe the following. Mark **PASS** only after seeing it work; otherwise use **FAIL** or **NOT TESTED**.

| Observation | PASS | FAIL | NOT TESTED | Notes |
|---|:---:|:---:|:---:|---|
| Traffic moves | [ ] | [ ] | [ ] | |
| Pedestrians move | [ ] | [ ] | [ ] | |
| Weather responds to city/time | [ ] | [ ] | [ ] | |
| Lighting looks appropriate | [ ] | [ ] | [ ] | |
| Player can drive | [ ] | [ ] | [ ] | |
| Vehicle condition is readable or documented as not exposed | [ ] | [ ] | [ ] | |
| Collision response occurs on contact | [ ] | [ ] | [ ] | |
| Return travel preserves usable player/save state | [ ] | [ ] | [ ] | |

## Screenshot checks

Save only screenshots captured during this manual test in `phase7b_verified_screenshots`. Do not copy the earlier Phase 7 diagnostic images into this folder. Confirm each image shows its expected city and, where supported, is 1920×1080 before marking the corresponding test as passed.

## Results

| Required result | PASS | FAIL | NOT TESTED | Notes |
|---|:---:|:---:|:---:|---|
| Kano HUD before travel | [ ] | [ ] | [ ] | |
| Abuja HUD after arrival | [ ] | [ ] | [ ] | |
| Correct Abuja arrival district | [ ] | [ ] | [ ] | |
| Abuja welcome appears and expires | [ ] | [ ] | [ ] | |
| Kano HUD and world after return | [ ] | [ ] | [ ] | |
