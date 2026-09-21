import { test } from "node:test";
import assert from "node:assert/strict";
import { NOTIFICATION_TONE_COUNT, notificationToneIndex } from "./tone";

/**
 * 종류 → 색 칸. 표가 아니라 **셈**이라 시험할 것이 셋이다:
 * 언제나 같은 답인가 · 칸 안에 드는가 · 실제로 도는 종류들이 갈라지는가.
 */

/**
 * 🔴 **A/S 에서 실제로 도는 여덟 종류**(그쪽 domain/notifications.ts 의
 * NOTIFICATION_KINDS). 이 묶음의 **실사용 코드**는 이 목록을 모른다 — 여기
 * 적어 둔 것은 「지금 도는 값으로 정말 갈라지는가」를 보기 위한 표본이다.
 *
 * 🔴 저쪽이 종류를 늘려도 이 시험은 깨지지 않는다(표본은 이대로 둔다). 새
 * 종류가 옛 종류와 같은 칸에 앉을 수는 있는데, 그래도 종류 **이름은 글자로**
 * 그려지므로 정보가 사라지지 않는다 — tone.ts 머리말.
 */
const A_S_종류 = [
  "REPAIR_CASE_APPROVAL",
  "PART_REQUEST_PENDING",
  "PART_STOCK_BELOW_MINIMUM",
  "CUSTOMER_REPAIR_REQUEST_NEW",
  "PART_ISSUE_APPROVAL_PENDING",
  "QUOTE_APPROVAL_PENDING",
  "APPROVAL_GRANTED",
  "APPROVAL_REJECTED",
] as const;

test("언제나 같은 칸이다 — 같은 종류는 어느 화면에서도 같은 색", () => {
  for (const kind of A_S_종류) {
    assert.equal(notificationToneIndex(kind), notificationToneIndex(kind));
  }
});

test("어떤 글자를 넣어도 칸 안에 든다 — CSS 에 없는 번호가 나오면 색이 사라진다", () => {
  const 별난값 = ["", " ", "a", "한글 종류", "🔔", "x".repeat(500), "::::"];

  for (const kind of [...A_S_종류, ...별난값]) {
    const tone = notificationToneIndex(kind);
    assert.ok(Number.isInteger(tone), `${kind} → ${tone} 는 정수가 아니다`);
    assert.ok(tone >= 0 && tone < NOTIFICATION_TONE_COUNT, `${kind} → ${tone} 가 칸 밖이다`);
  }
});

test("🔴 지금 도는 여덟 종류가 서로 다른 칸에 앉는다 — 한 패널에 섞여도 갈라진다", () => {
  const tones = A_S_종류.map((kind) => notificationToneIndex(kind));

  assert.equal(
    new Set(tones).size,
    A_S_종류.length,
    `여덟 종류가 ${new Set(tones).size} 칸에만 앉는다: ${tones.join(", ")}`
  );
});

test("한 글자만 달라도 대개 다른 칸이다 — 비슷한 이름끼리 뭉치지 않는다", () => {
  const 비슷한이름 = ["APPROVAL_A", "APPROVAL_B", "APPROVAL_C", "APPROVAL_D"];
  const tones = 비슷한이름.map((kind) => notificationToneIndex(kind));

  assert.equal(new Set(tones).size, 비슷한이름.length, `${tones.join(", ")}`);
});
