/**
 * @dss/ui — 사내 시스템들이 **함께 쓰는** 화면 조각.
 *
 * 지금 들어 있는 것은 둘이다 — 서비스 오가기 **메뉴바**와 알림 **종**.
 * 사이트가 다섯이 될 예정이라 같은 코드를 다섯 벌 두지 않으려고 묶음으로 뺐다.
 *
 * 🔴 이 묶음은 **네트워크를 타지 않는다.** 로그인도 포털도 DB 도 모르고,
 *    받은 자료를 그리기만 한다. 무엇을 넣을지는 사이트가 정한다.
 *    가져다 쓰는 방법과 각 사이트에 붙이는 자리는 README.md 를 볼 것.
 *
 * 스타일시트는 이 파일이 아니라 따로 가져간다(번들러 없이 도는 시험을
 * 지키기 위해서다). 🔴 **조각마다 한 장**이다 — 쓰는 것만 부르면 된다:
 *   import "@dss/ui/styles.css";             // 메뉴바
 *   import "@dss/ui/notification-bell.css";  // 종
 */
export { ServiceMenuBar, DEFAULT_SERVICE_ICON } from "./service-menu/ServiceMenuBar";
export type {
  ServiceMenuBarProps,
  ServiceMenuColorScheme,
  ServiceMenuVariant,
} from "./service-menu/ServiceMenuBar";
export {
  normalizeServiceMenu,
  isSafeServiceUrl,
  MAX_ICON_LENGTH,
} from "./service-menu/normalize";
export type { ServiceMenuEntry } from "./service-menu/types";

export { NotificationBell } from "./notification-bell/NotificationBell";
export type {
  NotificationBellProps,
  NotificationBellColorScheme,
} from "./notification-bell/NotificationBell";
export { isSafeNotificationHref } from "./notification-bell/normalize";
export { notificationToneIndex, NOTIFICATION_TONE_COUNT } from "./notification-bell/tone";
export type { NotificationBellItem } from "./notification-bell/types";
