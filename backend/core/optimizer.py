from __future__ import annotations
"""
Optimizer — Scores and ranks slot options by priority:
1. Same day (combo)
2. Same clinic (preferred)
3. Same doctor (preferred)
4. Earliest availability
5. Fewest total visits
"""
from core.scheduling_engine import SlotOption


def optimize_slots(
    slots: list[SlotOption],
    preferred_clinic_id: str | None = None,
    preferred_doctor_id: str | None = None,
) -> list[SlotOption]:
    """Score and sort slots according to optimization priority order."""

    for slot in slots:
        score = 0.0

        # 1. Combo (same day treatment) = highest priority
        if slot.type == "COMBO":
            score += 100

        # 2. Same clinic preference
        if preferred_clinic_id and slot.clinic_id == preferred_clinic_id:
            score += 30

        # 3. Same doctor preference
        if preferred_doctor_id and slot.doctor_id == preferred_doctor_id:
            score += 20

        # 4. Earlier date = higher score (inverse of day offset)
        try:
            from datetime import date as dt_date
            slot_date = dt_date.fromisoformat(slot.date)
            today = dt_date.today()
            days_away = (slot_date - today).days
            score += max(0, 20 - days_away)  # Up to 20 points for sooner
        except Exception:
            pass

        # 5. Earlier time within same day
        try:
            score += max(0, (17 - int(slot.time.split(":")[0])) * 0.5)
        except Exception:
            pass

        # 6. Single-visit bonus (COMBO already gets this)
        if slot.type == "SINGLE":
            score += 10  # Better than consult-only

        slot.score = score

    # Sort by score descending, then date ascending
    slots.sort(key=lambda s: (-s.score, s.date, s.time))

    # Deduplicate: keep top 10 unique date+time combinations
    seen = set()
    unique = []
    for s in slots:
        key = (s.date, s.time, s.doctor_id, s.type)
        if key not in seen:
            seen.add(key)
            unique.append(s)
            if len(unique) >= 10:
                break

    return unique
