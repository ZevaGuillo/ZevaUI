// Five cases that MUST NOT appear in components[] (RF-UAW03/06). Each earns
// its place: subpath decoys prove the exact-equality specifier filter,
// comment/string/template decoys prove stage 1's literal blanking.
import "@zevaui/components/styles.css";
import manifest from "@zevaui/components/components.manifest.json";
import { Button } from "some-other-design-system";
// import { Ghost } from "@zevaui/components";
const decoyTemplate = `import { Ghost } from "@zevaui/components";`;

export { manifest, decoyTemplate };
export { Button as UnrelatedButton };
