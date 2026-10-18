# Final Visual Review — Screenshot Selection

**Purpose:** Select canonical screenshots for GPT-5.6 Sol High final visual review.  
**Selection principle:** Maximum information density, canonical final state only, no rejected variants.

---

## Selected Screenshots (20 total)

### HOME (5 screenshots)

**H01** - `h01-bright-hero-desktop.png`  
Page: Home (Desktop)  
Demonstrates: Latest-first hierarchy, 75svh Hero, bright/high-key photo as exhibition entrance, quiet cue  
Relevant: G2 / G3  

**H02** - `h02-dark-hero-mobile.png`  
Page: Home (Mobile portrait)  
Demonstrates: Dark cover photo handling, mobile Hero 70svh cap, vertical progression  
Relevant: G3  

**H04** - `h04-chinese-title-hero-desktop.png`  
Page: Home (Desktop)  
Demonstrates: Mixed-script support (Chinese + Latin), typography personality with restraint  
Relevant: G1  

**H05** - `h05-cue-desktop.png`  
Page: Home (Desktop)  
Demonstrates: Plain-text cue above date, Canvas color #F6F4EF background  
Relevant: G2 / G3  

**H06** - `h06-recent-desktop.png`  
Page: Home (Desktop)  
Demonstrates: Recently added / backfill cue, archive relationship  
Relevant: T1  

---

### ARCHIVE (2 screenshots)

**A01** - `a01-mixed-year-desktop.png`  
Page: Archive (Desktop)  
Demonstrates: Multiple year groups, mixed cover images, flat list + groupings discovery pattern  
Relevant: T1  

**A03** - `a03-years-mobile-end.png`  
Page: Archive (Mobile)  
Demonstrates: Multiyear display on mobile, long-tail pagination  
Relevant: T1  

---

### PLACES (3 screenshots)

**P01** - `p01-flat-mobile.png`  
Page: Places Index (Mobile)  
Demonstrates: Name-led baseline, clean text-based navigation, no aggregate counts  
Relevant: T2  

**P02** - `p02-grouped-desktop.png`  
Page: Places Index (Desktop)  
Demonstrates: Progressive grouping by region, disambiguation pattern  
Relevant: T2  

**P04** - `p04-multiplace-card-desktop.png`  
Page: Place Detail (Desktop)  
Demonstrates: Place page flat + progressive grouped states, visit model presentation  
Relevant: T2  

---

### GALLERY (8 screenshots — highest priority)

**G01** - `g01-bright-desktop.png`  
Page: Gallery (Desktop top)  
Demonstrates: Bright photo first, canonical URL `/galleries/{slug}`, Photo > Whitespace > Typography hierarchy  
Relevant: G4 / G1  

**G02** - `g02-dark-mobile.png`  
Page: Gallery (Mobile portrait)  
Demonstrates: Dark photo handling, mobile Base 64px rhythm, vertical progression  
Relevant: G4  

**G05** - `g05-caption-desktop.png`  
Page: Gallery (Desktop mixed sequence)  
Demonstrates: 3-line caption, Chinese+Latin mix, persistent bottom-right `n/total`, raised backing tabular numerals  
Relevant: G5 / G1  

**G06** - `g06-zh-desktop.png`  
Page: Gallery (Desktop CJK title)  
Demonstrates: Long CJK title wrap within reading column, typography metrics  
Relevant: G1  

**G07** - `g07-mid-desktop.png`  
Page: Gallery (Long Gallery mid)  
Demonstrates: Continuous rhythm at Base 96px, sustainable scrolling, spacing consistency  
Relevant: G4  

**G08** - `g08-end-desktop.png`  
Page: Gallery (Long Gallery end)  
Demonstrates: Authored ending with End pause 168px, Next serif 28px, Back link placement  
Relevant: G7  

**G09** - `g09-l72-mobile.png`  
Page: Gallery (Long gallery mobile continuation)  
Demonstrates: Long sequence continuation on mobile, No recommendation feed after end  
Relevant: G7 / T3  

**G11** - `g11-breathing-desktop.png`  
Page: Gallery (Desktop breathing mode editorial variant)  
Demonstrates: Breathing 144px layout, not adopted but documented  
Relevant: G4 (editorial only)  

---

### OVERVIEW (2 screenshots)

**O01** - `o01-desktop.png`  
Page: Overview modal (Desktop)  
Demonstrates: 6-column grid (≈111px cells at ≤1100px), light table subordinate to photo-first  
Relevant: G6  

**O02** - `o02-mobile.png`  
Page: Overview modal (Mobile landscape/portrait)  
Demonstrates: 3-column grid at 390px width (≈111px cells), current marker system, opaque raised layer  
Relevant: G6  

---

### ABOUT / NAVIGATION (1 screenshot)

**B01** - `b01-desktop.png`  
Page: About (Desktop)  
Demonstrates: Textual low-weight page, site structure clarity  
Relevant: Product IA  

---

## Excluded (historical comparison only, not in main packet)

- Rejected Gate variants: G4 56px, G5 inline form, G6 2-column, G7 alternative weights  
- Debug harness pages (`?hero=`, `?nbase=`, `?mbase=`)  
- Temporary scale tests (~80 galleries)  
- A11y mechanical verification screenshots (referenced in secondary docs)  

---

## Coverage Summary

| Section | Count | Pages Covered |
|---|---|---|
| Home | 5 | Desktop / Mobile, bright / dark / Chinese title, recently added |
| Archive | 2 | Desktop multiyear / Mobile pagination |
| Places | 3 | Index flat & grouped / Place detail desktop |
| Gallery | 8 | Desktop top/mid/end / Mobile long sequence, bright/dark/caption/CJK/continuation |
| Overview | 2 | Desktop 6-col / Mobile 3-col |
| About/Nav | 1 | About textual page |
| **Total** | **20** | All canonical routes + key states |

All selected screenshots are from deterministic r1 captures (identical to r2 SHA256 manifest).
