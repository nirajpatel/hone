# AI Suggestion Clarifications

## Extraction History - How Many Extractions Are Included?

**Answer: Maximum of 6 extractions (5 most recent + best extraction if not in top 5)**

### Implementation Details

When a user opens the AI Suggestions panel for a coffee:

1. The frontend filters extractions to find ALL that match:
   - Same `coffeeId` 
   - Same `brewMethod` (espresso, pour over, etc.)

2. These are sorted by date (most recent first)

3. The backend selects which extractions to include:
   - **5 most recent extractions** (already sorted)
   - **Best extraction** (highest quality rating) if it's not already in the top 5
   
4. The selected extractions (max 6) are re-sorted chronologically and added to the prompt

5. Special markers are added:
   - ⭐ **REFERENCE EXTRACTION** - The extraction being analyzed for suggestions
   - 🏆 **BEST RECORDED EXTRACTION** - The highest quality extraction in history
   - Both markers appear together if an extraction is both reference and best

### Why This Design?

- **Focused Context**: Limits prompt size while providing relevant recent history
- **Learning from Success**: Always includes the best extraction as a reference point for what works
- **Token Efficiency**: Keeps prompts manageable even for coffees with 50+ extractions
- **Better Analysis**: Recent extractions + best extraction provide optimal context for improvement suggestions
- **High Confidence Justification**: With up to 6 extractions, the AI can meet the "at least two prior extractions" requirement for High confidence ratings

### Example Scenarios

**Scenario 1: Best extraction is recent (in top 5)**
- Result: 5 extractions total (top 5 includes the best)

**Scenario 2: Best extraction is older (not in top 5)**
- Result: 6 extractions total (5 recent + 1 best from the past)

**Scenario 3: Reference extraction is also the best**
- Result: Marked as "⭐ REFERENCE EXTRACTION, 🏆 BEST RECORDED EXTRACTION"

---

## Period Usage in JSON Responses

### Rule: "no period at end" 

This applies to specific fields in the JSON output format:

#### Fields WITHOUT periods:
- ✅ `action`: "Grind finer by moving to 13.5 on Niche Zero"
- ✅ `effect`: "This will slow the flow to 30-32 seconds and reduce sourness while building more body"
- ✅ `reasoning`: "An earlier excellent extraction at 13.5 delivered balanced flavor with 31s extraction time, and the current grind at 14 is producing fast flow and under-extraction"
- ✅ `validation`: "If extraction time reaches 30-32s with reduced sourness and fuller body, this confirms proper adjustment"
- ✅ `primaryIssue`: "under-extracted due to fast flow"

#### Fields WITH periods (normal sentences):
- ✅ `summary`: "The reference extraction rated decent with sour and thin body, indicating under-extraction from the fast 28-second flow."
- ✅ First-time `introduction`: "Southern Weather is a light roast Colombian coffee with delicate floral and fruit notes that will shine with proper extraction."
- ✅ First-time `explanation`: "This medium-fine setting allows for proper extraction of light roasts while maintaining a 2:45-3:15 brew time."
- ✅ First-time `note`: "These are based on common best practices for this brew method and equipment."

### Why This Design?

The fields without periods (action, effect, reasoning, validation) are displayed in the UI concatenated together with added periods:

```typescript
{addPeriod(suggestion.action)} {addPeriod(suggestion.effect)} {addPeriod(suggestion.reasoning)}
```

The `addPeriod` helper function adds periods if they're missing, so the JSON format deliberately excludes them to avoid double periods.

**Result in UI:**
> "Grind finer by moving to 13.5 on Niche Zero. This will slow the flow to 30-32 seconds and reduce sourness while building more body. An earlier excellent extraction at 13.5 delivered balanced flavor with 31s extraction time, and the current grind at 14 is producing fast flow and under-extraction."

This creates natural, flowing text while keeping the JSON clean and consistent.
