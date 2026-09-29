from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass(frozen=True)
class AlignmentPair:
    index_a: int | None
    index_b: int | None
    score: float


def needleman_wunsch(
    similarity: np.ndarray,
    gap_penalty: float = 0.35,
    match_threshold: float = 0.75,
) -> list[AlignmentPair]:
    rows, cols = similarity.shape
    if rows == 0 and cols == 0:
        return []
    if rows == 0:
        return [AlignmentPair(None, j, 0.0) for j in range(cols)]
    if cols == 0:
        return [AlignmentPair(i, None, 0.0) for i in range(rows)]

    dp = np.zeros((rows + 1, cols + 1), dtype=np.float32)
    trace = np.full((rows + 1, cols + 1), "", dtype=object)

    for i in range(1, rows + 1):
        dp[i, 0] = dp[i - 1, 0] - gap_penalty
        trace[i, 0] = "up"
    for j in range(1, cols + 1):
        dp[0, j] = dp[0, j - 1] - gap_penalty
        trace[0, j] = "left"

    for i in range(1, rows + 1):
        for j in range(1, cols + 1):
            match = dp[i - 1, j - 1] + float(similarity[i - 1, j - 1])
            delete = dp[i - 1, j] - gap_penalty
            insert = dp[i, j - 1] - gap_penalty

            if match >= delete and match >= insert:
                dp[i, j] = match
                trace[i, j] = "diag"
            elif delete >= insert:
                dp[i, j] = delete
                trace[i, j] = "up"
            else:
                dp[i, j] = insert
                trace[i, j] = "left"

    pairs: list[AlignmentPair] = []
    i, j = rows, cols
    while i > 0 or j > 0:
        direction = trace[i, j]
        if direction == "diag":
            score = float(similarity[i - 1, j - 1])
            pairs.append(AlignmentPair(i - 1, j - 1, score))
            i -= 1
            j -= 1
        elif direction == "up":
            pairs.append(AlignmentPair(i - 1, None, 0.0))
            i -= 1
        else:
            pairs.append(AlignmentPair(None, j - 1, 0.0))
            j -= 1

    pairs.reverse()

    filtered: list[AlignmentPair] = []
    for pair in pairs:
        if pair.index_a is None or pair.index_b is None:
            filtered.append(pair)
            continue
        if pair.score >= match_threshold:
            filtered.append(pair)
        else:
            filtered.append(AlignmentPair(pair.index_a, None, pair.score))
            filtered.append(AlignmentPair(None, pair.index_b, pair.score))

    return filtered
