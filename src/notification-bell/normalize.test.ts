import { test } from "node:test";
import assert from "node:assert/strict";
import { isSafeNotificationHref } from "./normalize";

/**
 * 🔴 이 값은 **남의 시스템에서 온 글자**다. 그릴 수 있는 주소와 아닌 것을
 *    가르는 선이 여기 하나뿐이므로, 그 선을 글자로 못 박는다.
 */

test("보통 주소는 그대로 통과한다", () => {
  for (const href of [
    "https://as.example/repair-cases/1",
    "http://192.168.0.10:3000/inventory/requests",
    "https://as.example/quotes?tab=approval#top",
    "/inventory/requests",
    "/",
  ]) {
    assert.equal(isSafeNotificationHref(href), true, href);
  }
});

test("🔴 링크로 그리면 안 되는 주소는 걸린다", () => {
  for (const href of [
    // 클릭 한 번이 그 화면에서 남의 코드를 돌리는 문이 된다.
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    "  javascript:alert(1)",
    "data:text/html,<script>x</script>",
    "vbscript:msgbox(1)",
    // 프로토콜 생략 — 사내망은 http 와 https 가 섞여 있어 어느 쪽으로 붙을지
    // 주소만 보고 알 수 없다.
    "//as.example/repair-cases/1",
    // 포털 안의 없는 주소로 간다.
    "repair-cases/1",
    "",
  ]) {
    assert.equal(isSafeNotificationHref(href), false, href);
  }
});

test("대소문자를 가리지 않는다 — 보낸 쪽이 어떻게 적든 같은 판정이다", () => {
  assert.equal(isSafeNotificationHref("HTTPS://as.example/x"), true);
  assert.equal(isSafeNotificationHref("Http://as.example/x"), true);
});
