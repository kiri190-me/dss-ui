/**
 * @dss/ui — 사내 시스템들이 **함께 쓰는** 화면 조각.
 *
 * 지금 들어 있는 것은 서비스 오가기 메뉴바 하나다. 사이트가 다섯이 될
 * 예정이라 같은 코드를 다섯 벌 두지 않으려고 묶음으로 뺐다.
 *
 * 🔴 이 묶음은 **네트워크를 타지 않는다.** 로그인도 포털도 DB 도 모르고,
 *    받은 자료를 그리기만 한다. 무엇을 넣을지는 사이트가 정한다.
 *    가져다 쓰는 방법과 각 사이트에 붙이는 자리는 README.md 를 볼 것.
 *
 * 스타일시트는 이 파일이 아니라 따로 가져간다(번들러 없이 도는 시험을
 * 지키기 위해서다):
 *   import "@dss/ui/styles.css";
 */
export { ServiceMenuBar, DEFAULT_SERVICE_ICON } from "./service-menu/ServiceMenuBar";
export type {
  ServiceMenuBarProps,
  ServiceMenuColorScheme,
} from "./service-menu/ServiceMenuBar";
export {
  normalizeServiceMenu,
  isSafeServiceUrl,
  MAX_ICON_LENGTH,
} from "./service-menu/normalize";
export type { ServiceMenuEntry } from "./service-menu/types";
