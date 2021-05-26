import { readdirSync, statSync, existsSync } from "fs";

interface Command {
	name: string;
	handler: string;
	config: string;
}

export const getCommands = () => {
	const cmdCategoryDir = `${__dirname}/commands`;
	const commands: Array<Command> = [];

	getDirectories(cmdCategoryDir).forEach((catDir) => {
		getDirectories(`${cmdCategoryDir}/${catDir}`).forEach((cmdDir) => {
			const handler = `${cmdCategoryDir}/${catDir}/${cmdDir}/${cmdDir}.ts`;
			const config = `${cmdCategoryDir}/${catDir}/${cmdDir}/${cmdDir}.yaml`;

			if (existsSync(handler) && existsSync(config)) {
				commands.push({ name: cmdDir, handler, config });
			} else {
				console.log(
					`Command ${cmdDir} has been skipped because handler or config is missing.`
				);
			}
		});
	});

	return commands;
};

const getDirectories = (path: string) => {
	return readdirSync(path).filter((file) => {
		return statSync(path + "/" + file).isDirectory();
	});
};
