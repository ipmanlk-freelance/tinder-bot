import { parseYAML } from "./parse";

export const getBotConfig = () => {
	return parseYAML(`${__dirname}/../../setup/config.yaml`);
};
