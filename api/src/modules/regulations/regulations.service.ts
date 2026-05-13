import regulationsCatalog from "../../data/regulations.json";

type RegulationCreditRule =
  | { type: "fixed"; value: number }
  | { type: "minimum"; value: number }
  | { type: "maximum"; value: number }
  | { type: "range"; min: number; max: number };

type RegulationCategory = {
  code: string;
  name: string;
  rule: RegulationCreditRule;
};

type Regulation = {
  code: string;
  name: string;
  curriculumStructure: {
    totalCreditsRequired: number;
    categories: RegulationCategory[];
  };
};

type RegulationsCatalog = {
  regulations: Regulation[];
};

export async function fetchRegulationsFromJson() {
  const catalog = regulationsCatalog as RegulationsCatalog;
  return {
    regulations: catalog.regulations ?? [],
  };
}

