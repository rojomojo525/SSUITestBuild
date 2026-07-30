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
- BioDAW provides the user-facing audio workstation interface
- MediMuse operates beneath BioDAW
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

## Project status

Initial repository setup is in progress. The next deliverable is a verified
Hello World static page using the available BioDAW client library.

## Stewardship

Robert Joseph retains authorship and final authority for project intent and
direction. Peter Slack and Trebor participate as co-development collaborators
within the authority and scope Robert establishes.

