import { Message, MessageEmbed } from "discord.js";
const Pagination = require("discord-paginationembed");

import { getBotConfig, getReactionRoleConfig } from "../../../util/config";
import { parseYAML } from "../../../util/parse";

const botConfig: any = getBotConfig();
const cmdConfig: any = parseYAML(`${__dirname}/swipe.yaml`);
const reactionRoleConfig: any = getReactionRoleConfig();

export const handle = async (msg: Message) => {
	const genderRoleNames = reactionRoleConfig["ROLE NAMES"];

	if (cmdConfig["SWIPE CHANNEL"] !== msg.channel.id) {
		return;
	}

	const mentionedGenderRole = msg.mentions.roles.first();

	if (!mentionedGenderRole) {
		msg
			.reply({
				embed: {
					color: 0xff0000,
					description: "Please mention a gender role.",
				},
			})
			.then((m) => m.delete({ timeout: 5000 }));
		msg.react("🛑");
		msg.delete({ timeout: 5000 });
		return;
	}

	if (!Object.keys(genderRoleNames).includes(mentionedGenderRole.id)) {
		msg
			.reply({
				embed: {
					color: 0xff0000,
					description: "Please mention a valid gender role.",
				},
			})
			.then((m) => m.delete({ timeout: 5000 }));
		msg.react("🛑");
		msg.delete({ timeout: 5000 });

		return;
	}

	const embeds: Array<MessageEmbed> = [];

	mentionedGenderRole.members.forEach((member) => {
		const embed = new MessageEmbed();
		const avatarUrl = member.user.avatarURL();

		if (avatarUrl) {
			embed.setImage(avatarUrl);
		}

		embed.setThumbnail(
			"https://cdn.discordapp.com/attachments/847152087304241182/847154551748558848/14980362bff8218406381df35beaa368.gif"
		);

		embed.fields = [
			{
				name: "Member",
				value: member.nickname || member.user.username,
				inline: false,
			},
			{
				name: "Gender",
				value: genderRoleNames[mentionedGenderRole.id],
				inline: false,
			},
		];
		embeds.push(embed);
	});

	const dm = await msg.author.send({
		embed: {
			color: 0x2d91e7,
			description:
				"Please be patient. You will get all machines in a few moments.",
		},
	});

	new Pagination.Embeds()
		.setArray(embeds)
		.setAuthorizedUsers([msg.author.id])
		.setChannel(dm.channel)
		.setColor(0x2d91e7)
		.setFooter("Please goto #match channel to start a chat with this person.")
		.setPageIndicator(true)
		.build();

	msg.delete({ timeout: 5000 }).catch((e) => {});
};
