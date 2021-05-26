import { Client, TextChannel } from "discord.js";
import { ReactionRole } from "./ReactionRole";

import { getBotConfig } from "../../util/config";
import { parseYAML } from "../../util/parse";

const botConfig: any = getBotConfig();
const cmdConfig: any = parseYAML(`${__dirname}/reaction_role.yaml`);

export const init = async (client: Client) => {
	// find the channel
	let channel;

	client.guilds.cache.every((guild) => {
		const guildChannel = guild.channels.cache.get(
			cmdConfig["REACTION ROLE CHANNEL"]
		);
		if (guildChannel) {
			channel = guildChannel;
			return false;
		}
		return true;
	});

	if (!channel) {
		console.log("Unable to find the reaction role channel.");
		return;
	}

	const reactionRoleChannel = channel as TextChannel;

	// get the first msg
	await reactionRoleChannel.messages.fetch();
	let firstMsg = reactionRoleChannel.messages.cache
		.filter((m) => m.author.id == client.user?.id)
		.first();

	if (!firstMsg) {
		firstMsg = await reactionRoleChannel.send("_");
	}

	await firstMsg.reactions.removeAll();

	const embed = {
		title: "Select your gender",
		description: "Please react to add a gender role.\n",
		color: 0x2d91e7,
		thumbnail: {
			url: "https://i.postimg.cc/PJpHdCHK/1eed36b3af5647977e115f3a131e8bae.jpg",
		},
		footer: {
			text: "Please note that you can only have one gender role at a time.",
		},
	};

	const roleReactions = cmdConfig["ROLE REACTIONS"];

	// roles for rr roles
	const rrRoles: Array<any> = [];

	Object.keys(roleReactions).forEach((roleId) => {
		const emoji = roleReactions[roleId];
		embed.description += `<@&${roleId}> = ${emoji}\n`;
		rrRoles.push({
			messageId: firstMsg?.id,
			reaction: emoji,
			roleId: roleId,
			unique: true,
		});
		firstMsg?.react(emoji);
	});

	await firstMsg.edit("", { embed: embed });

	const rr = new ReactionRole(client, rrRoles);

	rr.on("roleAdd", (member, role) => {
		console.log("roleAdd");
	});

	rr.on("roleRemove", (member, role) => {
		console.log("roleRemove");
	});

	rr.on("hasUniqueRole", (member, uniqueRole, uniqueRoleIds) => {
		console.log("hasUniqueRole");
	});

	rr.on("error", (error) => {
		console.log("error");
	});
};

// wrapper
export const reactionRole = { init };
