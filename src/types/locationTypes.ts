export interface Village {
  name: string;
}

export interface Cell {
  name: string;
  villages: Village[];
}

export interface Sector {
  name: string;
  cells: Cell[];
}

export interface District {
  name: string;
  sectors: Sector[];
}

export interface Province {
  name: string;
  districts: District[];
}

export interface LocationsData {
  provinces: Province[];
}

export interface LocationData {
  province: string;
  district: string;
  sector: string;
  cell: string;
  village: string;
}
