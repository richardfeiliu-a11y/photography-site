# Prototype Test Plan

Only four high-leverage questions remain. Each test begins with the recommended default and a credible alternative; the purpose is to reduce interaction risk, not reopen the whole IA.

## Test 1 — Homepage priority

**Question**  
Does a latest-first Home communicate “online photography exhibition with an archive behind it” while keeping Archive discovery easy?

**Variant A — Recommended default**  
One visually dominant Home Gallery, a short recent set, then clear Archive and Places entries. Both variants use the same content rule: one optional featured override; otherwise latest by `date added/published` descending.

**Variant B**  
Archive-first Home with year/place discovery visible before any featured Gallery.

**Optional Variant C**  
None. An equal-weight split would avoid the decision rather than test it.

**What we are testing**

- First-impression product identity.
- Ability to open recent work and find older work.
- Whether archive links remain discoverable without turning the first screen into a database UI.
- Whether a backfilled Gallery shown as the latest addition is understood, and whether the optional featured override remains clearly editorial rather than historical.

**Success criteria**

- Participants describe the site as photography/archive/exhibition, not portfolio service, travel tracker, or database.
- They can start the latest Gallery and reach the complete Archive without instruction.
- Latest content receives primary attention while Archive/Places remain clearly available.

**Desktop**  
Test first screen, short scroll, and Archive transition at a realistic wide viewport.

**Mobile**  
Test whether the featured work remains primary without pushing Archive/Places beyond reasonable discovery or causing horizontal overflow.

**Decision after test**  
Keep Variant A unless it materially hides the complete archive or misclassifies the product.

## Test 2 — Repeated Place page

**Question**  
Can a visitor understand one persistent Paris across years and find a specific Paris Gallery without a Visit layer?

**Variant A — Recommended default**  
Progressive grouping: flat reverse-chronological cards at low volume; photographed-year headings appear when repeated years and scanning clarity justify them.

**Variant B**  
Always-flat reverse-chronological Gallery cards with year shown only inside each card.

**Optional Variant C**  
Always-grouped year headings at every content volume, used to detect the cost of premature structure. Raw photos and Visit groups remain excluded.

**What we are testing**

- Comprehension of repeated place across years.
- Findability with 3, 8, and 20 Galleries for one Place.
- Whether year headings improve orientation or create unnecessary structure.

**Success criteria**

- Participants understand Paris as one Place, not separate Paris-year entities.
- They can find a named or dated Gallery and explain the ordering.
- They do not infer that each year/group is a trip or Visit.

**Desktop**  
Compare scan time and comprehension across the three content volumes.

**Mobile**  
Check heading persistence, card density, long-page navigation, and return to Places without sticky clutter.

**Decision after test**  
Keep progressive grouping; use observed scan clarity to define when headings appear without creating a hard count threshold.

## Test 3 — Gallery sequence and overview

**Content fixtures**  
Use both a short Gallery and one representative long Gallery of roughly 50–100 mixed-orientation Photos with realistic image weights. This is a test fixture, not a Gallery-size rule. Short fixtures alone are not acceptance evidence for fatigue, scroll restoration, memory, or loading behavior.

**Question**  
Does a secondary overview help orientation and selective return without weakening the authored sequence?

**Variant A — Recommended default**  
Vertical ordered sequence with a quiet Overview control that shows a light table and jumps back into the same sequence.

**Variant B**  
Vertical ordered sequence only.

**Optional Variant C**  
Grid-first is excluded because it reverses the decided viewing priority.

**What we are testing**

- Whether visitors follow and recognize the intended sequence.
- Ability to understand Gallery scale, return to a remembered image, and recover position.
- Whether overview becomes an attractive bypass that turns viewing into thumbnail scanning.

**Success criteria**

- Sequence remains the default entry and dominant mode.
- Overview users can jump and return without losing orientation.
- Removing overview would create a demonstrated navigation problem in longer Galleries; otherwise it can be deferred.

**Desktop**  
Test keyboard, focus, overview-to-sequence jump, and long Gallery position.

**Mobile**  
Test touch target, return behavior, scroll restoration, and whether the overview becomes too dense.

**Decision after test**  
Keep overview in MVP only if it materially improves orientation without reducing sequence completion.

## Test 4 — Mobile mixed-orientation Gallery and continuation

**Content fixtures**  
Use the same short fixture and representative long fixture of roughly 50–100 mixed-orientation Photos as Test 3, with realistic image weights. The long fixture exists to expose fatigue, restoration, memory, navigation, and loading risks; it does not define Gallery size.

**Question**  
Does vertical progression outperform swipe-first progression for landscape, portrait, and long Galleries when caption, Overview, and continuation conditions remain identical?

**Variant A — Recommended default**  
Native vertical scroll with full-image access without forced crop.

**Variant B**  
Swipe-first single-image viewer with horizontal progression.

**Optional Variant C**  
None. Caption behavior, Overview state, and the end-of-Gallery continuation are fixed across A/B—Overview inherits Test 3's result—and are not variables in this test.

**Fixed conditions**

- The same caption content and visibility rule.
- The same Overview state inherited from Test 3.
- The same end screen: Next Gallery primary, Previous/Archive/Place secondary.

**What we are testing**

- Orientation mixing, reading rhythm, fatigue, and accidental horizontal movement.
- Back behavior and scroll restoration.
- Mobile viewing direction and sequence model; continuation is verified as a fixed requirement rather than compared as a variant.

**Success criteria**

- No horizontal page overflow or required precision gestures.
- Both orientations remain legible without destructive crop.
- Participants recognize the end and can continue or return without instruction.
- Browser Back returns to the originating Home/Archive/Place context at a sensible position.

**Desktop**  
Verify keyboard scrolling/focus and the same continuation hierarchy.

**Mobile**  
Test narrow and tall viewports, touch, rotation, long sequences, captions, and bottom continuation.

**Decision after test**  
Keep vertical sequence unless swipe-first demonstrates clearly better completion and orientation without introducing hidden controls or horizontal errors.
