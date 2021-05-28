import { Message, TextChannel } from "discord.js";

import { startRegistration } from "../../../non_commands/registration/registration";

import { getBotConfig } from "../../../util/config";
import { parseYAML } from "../../../util/parse";

const botConfig: any = getBotConfig();
const cmdConfig: any = parseYAML(`${__dirname}/register.yaml`);

export const handle = async (msg: Message) => {
	const client = msg.client;
	const member = msg.member;
	const guild = msg.guild;
	const msgChannel = msg.channel;

	await msg.react("✅");

	if (member && guild) {
		// find the reaction role channel
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

		if (firstMsg) {
			msgChannel
				.send(`<@${member.id}>,`, {
					embed: {
						title: "Registration started",
						color: 0xff007f,
						thumbnail: {
							url: "https://media2.giphy.com/media/l2ZDYicAc3XXjkpWw/giphy.gif",
						},
						description: `**Please check your direct messages.**`,
					},
				})
				.then((m) => {
					m.delete({ timeout: 10000 });
				});
			startRegistration(member, guild, firstMsg);
		}
	}
	msg.delete({ timeout: 5000 });
};
