import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  loadCatalogue,
  loadText,
  validateCatalogueMarkdown,
  validateAgainstSchema,
  validateFreezeMetadata,
  validateMappingCompleteness,
  validateNoDeferredReasoningLanguage,
  validateUniqueIds,
} from "./validators";

type Catalogue = {
  metadata?: {
    catalogue_version?: string;
    changelog?: unknown[];
  };
  principles?: Array<{
    question_id?: string;
    rationale?: string;
    ipm_mapping?: {
      ipm_section_heading?: string;
      ipm_field_key?: string;
    };
  }>;
};

const repoRoot = path.resolve(process.cwd(), "..");
const cataloguePath = path.join(
  repoRoot,
  "artifacts",
  "policy",
  "default",
  "decision-principles-catalogue.json"
);
const schemaPath = path.join(
  repoRoot,
  "artifacts",
  "policy",
  "default",
  "decision-principles-catalogue.schema.json"
);
const markdownPath = path.join(
  repoRoot,
  "artifacts",
  "policy",
  "default",
  "decision-principles-catalogue.md"
);

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("Decision Principles Catalogue - machine addressability", () => {
  it("policyCatalogue.validatesAgainstSchema", () => {
    const catalogue = loadCatalogue(cataloguePath);
    const schema = loadCatalogue(schemaPath);
    const errors = validateAgainstSchema(catalogue, schema);
    expect(errors).toEqual([]);
  });

  it("policyCatalogue.everyQuestionMapsToIPM", () => {
    const catalogue = loadCatalogue(cataloguePath);
    const errors = validateMappingCompleteness(catalogue);
    expect(errors).toEqual([]);
  });

  it("policyCatalogue.noDeferredReasoningLanguage", () => {
    const catalogue = loadCatalogue(cataloguePath);
    const errors = validateNoDeferredReasoningLanguage(catalogue);
    expect(errors).toEqual([]);
  });

  it("policyCatalogue.freezeMetadataPresent", () => {
    const catalogue = loadCatalogue(cataloguePath);
    const errors = validateFreezeMetadata(catalogue);
    expect(errors).toEqual([]);
  });

  it("policyCatalogue.markdownHasVersionAndChangelog", () => {
    const markdown = loadText(markdownPath);
    const errors = validateCatalogueMarkdown(markdown);
    expect(errors).toEqual([]);
  });

  it("rejects duplicate question_id", () => {
    const catalogue = clone(loadCatalogue(cataloguePath) as Catalogue);
    if (!catalogue.principles || catalogue.principles.length < 2) {
      throw new Error("Expected at least two principles.");
    }
    catalogue.principles[1].question_id = catalogue.principles[0]?.question_id;
    const errors = validateUniqueIds(catalogue);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects missing ipm_field_key", () => {
    const catalogue = clone(loadCatalogue(cataloguePath) as Catalogue);
    if (!catalogue.principles || catalogue.principles.length < 1) {
      throw new Error("Expected at least one principle.");
    }
    const mapping = catalogue.principles[0]?.ipm_mapping;
    if (!mapping) {
      throw new Error("Expected ipm_mapping.");
    }
    delete mapping.ipm_field_key;
    const errors = validateMappingCompleteness(catalogue);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects deferred reasoning language", () => {
    const catalogue = clone(loadCatalogue(cataloguePath) as Catalogue);
    if (!catalogue.principles || catalogue.principles.length < 1) {
      throw new Error("Expected at least one principle.");
    }
    catalogue.principles[0].rationale = "TBD";
    const errors = validateNoDeferredReasoningLanguage(catalogue);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects missing catalogue_version", () => {
    const catalogue = clone(loadCatalogue(cataloguePath) as Catalogue);
    if (!catalogue.metadata) {
      throw new Error("Expected metadata.");
    }
    delete catalogue.metadata.catalogue_version;
    const errors = validateFreezeMetadata(catalogue);
    expect(errors.length).toBeGreaterThan(0);
  });

  it("rejects empty changelog", () => {
    const catalogue = clone(loadCatalogue(cataloguePath) as Catalogue);
    if (!catalogue.metadata) {
      throw new Error("Expected metadata.");
    }
    catalogue.metadata.changelog = [];
    const errors = validateFreezeMetadata(catalogue);
    expect(errors.length).toBeGreaterThan(0);
  });
});
