# StateSong UI Test Build

This repository is the centralized development space for the first BioDAW
StateSong web interface co-developed by Robert Joseph (rOjO), Peter Slack, and
Trebor.

## First milestone

Bring up a pure client-side static website that uses the existing BioDAW and
MediMuse client APIs.

The intended novice workflow is:

1. Drop an existing Empatica E4 session into the browser.
2. Invoke the existing HeartSong algorithm.
3. Hear the resulting StateSong through BioDAW.

The user should not need to understand BioDAW, MediMuse, or HeartSong's internal
architecture.

## Technical direction

- Static client site with no required application server
- BioDAW is an external package dependency and is never rewritten or copied
  into this repository's public assets
- MediMuse may be accessed through the BioDAW client wrapper or directly
  through its published OpenAPI contract
- Existing Empatica E4 files provide the initial biometric input
- The existing HeartSong algorithm produces the StateSong
- GitHub is the centralized source, development record, and hosting location

## Current scope

- Establish a working browser-based Hello World
- Integrate the BioDAW and MediMuse client APIs
- Validate E4 session inputs
- Connect E4 input to HeartSong
- Load and play the resulting StateSong through BioDAW
- Keep the novice interface simple while preserving optional developer
  diagnostics

## Out of scope

- EEG input or EEG-derived composition
- Reimplementation of the HeartSong algorithm
- Server-side application architecture
- Requiring users to understand internal engine details

## Run locally

```bash
npm install
npm run dev
```

## Project status

The application was reset to Peter Slack's working `biodaw_app_example` login
shell on August 3, 2026. The reset baseline imports `biodaw` from the published
package, uses Keycloak with PKCE, supplies bearer tokens to MediMuse, creates
authenticated sessions, and reads public datasets.

Only the small Keycloak silent-SSO callback page is placed in `public`. No
BioDAW SDK, WebAssembly engine, soundfont, effects, or sample data is copied
there.

The previous E4 mapping studio and browser audio preview remain preserved in
Git history, but are deliberately absent from this clean baseline. They will be
restored only after BioDAW audio can consume externally managed runtime assets.
HeartSong audio and MIDI generation also remain work in progress.

## Stewardship

Robert Joseph retains authorship and final authority for project intent and
direction. Peter Slack and Trebor participate as co-development collaborators
within the authority and scope Robert establishes.
