// `@zevaui/audit/report-schema` is a pure, dependency-free JS module (see
// D4/design.md: "Shared by both audit's own tests and the ingestion API").
// It stays plain JavaScript with JSDoc on purpose -- it is not part of this
// migration's scope (packages/audit is untouched). This ambient declaration
// mirrors its exact JSDoc-documented contract so the ingestion pipeline gets
// real types at this boundary instead of an implicit `any`.
declare module "@zevaui/audit/report-schema" {
  export type ValidReport = { readonly valid: true };
  export type InvalidReport = {
    readonly valid: false;
    readonly field: string;
    readonly message: string;
  };
  export type ValidationResult = ValidReport | InvalidReport;

  export function validateReport(value: unknown): ValidationResult;
}
