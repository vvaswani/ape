import { describe, expect, it } from "vitest";

import {
  loadCatalogue,
  validateAgainstSchema,
  validateMappingCompleteness,
  validateNoDeferredReasoningLanguage,
  validateUniqueIds,
} from "./validators";

const cataloguePath = "../artifacts/policy/default/decision-principles-catalogue.json";
const schemaPath = "../artifacts/policy/default/decision-principles-catalogue.schema.json";

describe("Decision Principles Catalogue validators", () => {
  it("validates schema, uniqueness, mapping completeness, and forbidden phrases", () => {
    const catalogue = loadCatalogue(cataloguePath);
    const schema = loadCatalogue(schemaPath);

    const schemaErrors = validateAgainstSchema(catalogue, schema);
    const uniqueErrors = validateUniqueIds(catalogue);
    const mappingErrors = validateMappingCompleteness(catalogue);
    const languageErrors = validateNoDeferredReasoningLanguage(catalogue);

    expect(schemaErrors).toEqual([]);
    expect(uniqueErrors).toEqual([]);
    expect(mappingErrors).toEqual([]);
    expect(languageErrors).toEqual([]);
  });
});
