# DriveSense UI Components Guide

Brand new for this release is the transition to the **Bento Box Design System**, utilizing a Sage Green and Dark Emerald color palette inspired by modern mobile application trends.

## Color Palette
The app leverages the following curated tokens (defined in the components):
- **Background**: `#C9D6BC` (Sage Green) - Used for the main screen backgrounds.
- **Primary**: `#064E3B` (Dark Emerald) - Main actions and highlights.
- **Accent**: `#F59E0B` (Vibrant Orange) - Attention-grabbing secondary elements (like warnings).
- **Teal**: `#0D9488` - Used for nominal status indicators and positive feedback.
- **Card**: `#FFFFFF` - Crisp white used for all floating "Bento" panels.

## Bento Layout Specs
- **Border Radius**: Large, friendly `24px` radius applied to the main cards to create the "bento box" aesthetic.
- **Shadows**: Minimal to zero shadows to embrace a modern, clean, flat design ethos. Borders are occasionally used for separation instead of drop-shadows.

## Core Screens
1. **Dashboard (`index.tsx`)**: The primary view featuring large metric cards (Speed, RPM) organized in a grid layout.
2. **Simulator (`simulator.tsx`)**: A scrollable list of controls (sliders, mode toggles, fault injection chips).
3. **Diagnostics (`diagnostics.tsx`)**: A feed of active Electronic Control Unit (ECU) faults, presented in white cards with colored severity tags.
4. **History (`history.tsx`)**: A list-view of previously analyzed DTC codes.
