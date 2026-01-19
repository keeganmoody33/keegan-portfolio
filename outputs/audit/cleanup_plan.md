# Portfolio Cleanup Plan

Generated: 2026-01-19
Agent: @bloat-detector

---

## Summary

| Category | Count | Action |
|----------|-------|--------|
| Safe to Delete | 18 | DELETE immediately |
| Archive Candidate | 1 | MOVE to archive folder |
| Needs Review | 2 | Await human decision |
| Reclassified | 3 | Now CONTEXT (resolved) |

---

## IMMEDIATE DELETIONS (Safe - No Review Needed)

### Security-Sensitive Files
These contain personal data that creates risk with no portfolio value:

```bash
# LinkedIn security/personal data
rm "LinkedIn_Export/Logins.csv"
rm "LinkedIn_Export/Security Challenges.csv"
rm "LinkedIn_Export/PhoneNumbers.csv"
rm "LinkedIn_Export/Email Addresses.csv"
rm "LinkedIn_Export/Whatsapp Phone Numbers.csv"
```

### No Portfolio Value
LinkedIn data that serves no portfolio purpose:

```bash
# LinkedIn ad/engagement data
rm "LinkedIn_Export/Ad_Targeting.csv"
rm "LinkedIn_Export/Inferences_about_you.csv"
rm "LinkedIn_Export/Receipts.csv"
rm "LinkedIn_Export/Receipts_v2.csv"
rm "LinkedIn_Export/LAN Ads Engagement.csv"
rm "LinkedIn_Export/Votes.csv"
rm "LinkedIn_Export/InstantReposts.csv"
rm "LinkedIn_Export/LearningCoachMessages.csv"
rm "LinkedIn_Export/learning_coach_messages.csv"
rm "LinkedIn_Export/learning_role_play_messages.csv"
```

### Duplicates
Files that exist elsewhere:

```bash
# Archive of folder that exists unzipped
rm "How to Build an AI-Powered Portfolio Site.zip"

# Duplicate of CLAUDE.md
rm "Portfolio Assembly Agent System v2.1.md"  # root level copy
```

---

## VERIFY THEN DELETE

```bash
# Double extension - likely duplicate resume
# VERIFY: Does unique content exist in this file?
rm "KM 07072025.pdf.pdf"
```

---

## ARCHIVE (Move, Don't Delete)

These files are valuable but not needed during audit phase:

```bash
# Website build docs - keep for later website build phase
mkdir -p archive/website-build
mv "How to Build an AI-Powered Portfolio Site/" archive/website-build/
```

---

## NEEDS HUMAN REVIEW

### RAMP.docx
- **Location**: Root folder
- **Question**: What is this file? Is it relevant to your portfolio?
- **Options**:
  - A) Delete - not needed
  - B) Keep in portfolio - explain what it is
  - C) Archive - keep but not active

### RevsUp - Jetson - SDR.docx
- **Location**: Root folder
- **Question**: What is RevsUp/Jetson? Is this a role you pursued or work product?
- **Options**:
  - A) Delete - not needed
  - B) Keep as job application artifact
  - C) Keep as reference material

---

## RESOLVED (No Action Needed)

These were previously UNKNOWN but user clarified:

| File | Status | Resolution |
|------|--------|------------|
| Accolade/*.pdf | KEEP as CONTEXT | LecturesFrom side project |
| LecturesFrom-Website-Architecture.docx | KEEP as CONTEXT | User's company documentation |
| Punch 2 PEN.docx | KEEP as CONTEXT | LecturesFrom side project |

---

## LinkedIn Export Summary

### KEEP (Portfolio Value)
- Positions.csv - Employment proof
- Certifications.csv - Cert proof
- Publications.csv - Publication proof
- Education.csv - Education proof
- Skills.csv - Skills reference
- Profile.csv - Profile snapshot
- Connections.csv - Network reference
- Recommendations_Given.csv - Reference quality

### DELETE (No Value)
- All files in IMMEDIATE DELETIONS section above

### REVIEW (May Have Value)
- Job Applicant Saved*.csv - May contain interview prep notes
- Jobs/*.csv - May contain application history

---

## Execution

To execute safe deletions, run:

```bash
cd /Users/keeganmoody/keegan-portfolio-content

# Security files
rm -f "LinkedIn_Export/Logins.csv"
rm -f "LinkedIn_Export/Security Challenges.csv"
rm -f "LinkedIn_Export/PhoneNumbers.csv"
rm -f "LinkedIn_Export/Email Addresses.csv"
rm -f "LinkedIn_Export/Whatsapp Phone Numbers.csv"

# No-value files
rm -f "LinkedIn_Export/Ad_Targeting.csv"
rm -f "LinkedIn_Export/Inferences_about_you.csv"
rm -f "LinkedIn_Export/Receipts.csv"
rm -f "LinkedIn_Export/Receipts_v2.csv"
rm -f "LinkedIn_Export/LAN Ads Engagement.csv"
rm -f "LinkedIn_Export/Votes.csv"
rm -f "LinkedIn_Export/InstantReposts.csv"
rm -f "LinkedIn_Export/LearningCoachMessages.csv"
rm -f "LinkedIn_Export/learning_coach_messages.csv"
rm -f "LinkedIn_Export/learning_role_play_messages.csv"

# Duplicates
rm -f "How to Build an AI-Powered Portfolio Site.zip"
```

---

**AWAITING USER APPROVAL TO EXECUTE**

Reply with:
- `@bloat-detector: Execute approved deletions` to run safe deletions
- Answer questions for RAMP.docx and RevsUp files first if you want them reviewed

---

*Cleanup Plan v1.0 - @bloat-detector*
