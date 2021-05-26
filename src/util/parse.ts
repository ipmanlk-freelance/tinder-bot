import { readFileSync } from "fs";
import YAML from "yaml";

export const parseYAML = (filePath: string) =>
	YAML.parse(readFileSync(filePath, "utf8"));
