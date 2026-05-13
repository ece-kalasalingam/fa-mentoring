import programmesCatalog from "../../data/programmes.json";

type Programme = {
  id: number;
  name: string;
};

type ProgrammesCatalog = {
  programmes?: Programme[];
  pgrammes?: Programme[];
  default?: {
    programmes?: Programme[];
    pgrammes?: Programme[];
  };
};

export async function fetchProgrammesFromJson() {
  const catalog = programmesCatalog as ProgrammesCatalog | Programme[];
  const container = Array.isArray(catalog)
    ? { programmes: catalog }
    : (catalog.default ?? catalog);
  const raw = Array.isArray(container.programmes)
    ? container.programmes
    : Array.isArray(container.pgrammes)
      ? container.pgrammes
      : [];
  const programmes = raw
    .map((item) => {
      const obj = item as Record<string, unknown>;
      const idRaw =
        obj.id ??
        obj.ID ??
        obj.code ??
        obj.programme_id ??
        obj.programmeId ??
        obj.program_id ??
        obj.programId;
      const nameRaw =
        obj.name ??
        obj.programme ??
        obj.program ??
        obj.title;
      return {
        id: Number(idRaw),
        name: String(nameRaw ?? "").trim(),
      };
    })
    .filter((item) => Number.isInteger(item.id) && item.name.length > 0);
  return {
    programmes,
  };
}
