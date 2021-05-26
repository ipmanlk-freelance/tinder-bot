import { parseYAML } from "./parse";

export const getBotConfig = () => {
	return parseYAML(`${__dirname}/../../setup/config.yaml`);
};

export const getReactionRoleConfig = () => {
	return parseYAML(
		`${__dirname}/../non_commands/reaction_role/reaction_role.yaml`
	);
};
