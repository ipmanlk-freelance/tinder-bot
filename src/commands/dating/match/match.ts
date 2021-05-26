import { Message, MessageReaction, ReactionEmoji, User } from "discord.js";
import { getBotConfig } from "../../../util/config";
import { parseYAML } from "../../../util/parse";

const botConfig: any = getBotConfig();
const cmdConfig: any = parseYAML(`${__dirname}/match.yaml`);

export const handle = async (msg: Message) => {
	if (cmdConfig["MATCH CHANNEL"] !== msg.channel.id) {
		return;
	}

	const mentionedMember = msg.mentions.members?.first();

	if (!mentionedMember) {
		msg
			.reply({
				embed: {
					color: 0xff0000,
					description: "Please mention a member to match.",
				},
			})
			.then((m) => m.delete({ timeout: 5000 }));
		msg.react("🛑");
		msg.delete({ timeout: 5000 });
		return;
	}

	if (mentionedMember.id == msg.author.id) {
		msg
			.reply({
				embed: {
					color: 0xff0000,
					description: "You can't match yourself!.",
				},
			})
			.then((m) => m.delete({ timeout: 5000 }));
		msg.react("🛑");
		msg.delete({ timeout: 5000 });
		return;
	}

	msg.react("✅");
	msg.delete({ timeout: 5000 });

	const inviteMsg = await mentionedMember.send({
		embed: {
			color: 0xff007f,
			description: `Member **${
				msg.member?.nickname || msg.member?.user.username
			}** would like to start a private conversation with you.`,
		},
		footer: {
			text: "Please react with 👍 to accept or 👎 to reject.",
		},
	});

	await inviteMsg.react("👍");
	await inviteMsg.react("👎");

	const filter = (reaction: MessageReaction, user: User) => {
		return (
			["👍", "👎"].includes(reaction.emoji.name) &&
			user.id === mentionedMember.user.id
		);
	};

	let collected;
	try {
		collected = await inviteMsg.awaitReactions(filter, {
			max: 1,
			time: 60000,
			errors: ["time"],
		});
	} catch (e) {
		msg.author.send({
			embed: {
				color: 0xff0000,
				description: `**${
					mentionedMember.nickname || mentionedMember.user.username
				}** failed to reply to your invitation.`,
			},
		});
		mentionedMember.user.send({
			embed: {
				color: 0xff0000,
				description: `You failed to respond to the invitation from **${
					msg.member?.nickname || msg.author.username
				}**.`,
			},
		});
		return;
	}

	const reaction = collected.first();

	if (!reaction) return;

	if (reaction.emoji.name === "👍") {
		msg.author.send({
			embed: {
				color: 0x2d91e7,
				description: `**${
					mentionedMember.nickname || mentionedMember.user.username
				}** accepted your private chat invitation.`,
			},
		});
		mentionedMember.user.send({
			embed: {
				color: 0x2d91e7,
				description: `You accepted the invitation from **${
					msg.member?.nickname || msg.author.username
				}**.`,
			},
		});
	} else {
		msg.author.send({
			embed: {
				color: 0x2d91e7,
				description: `**${
					mentionedMember.nickname || mentionedMember.user.username
				}** rejected your private chat invitation.`,
			},
		});
		mentionedMember.user.send({
			embed: {
				color: 0x2d91e7,
				description: `You have rejected the private chat invitation from **${
					msg.member?.nickname || msg.author.username
				}**.`,
			},
		});
	}
};
