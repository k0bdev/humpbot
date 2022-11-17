import Discord, { ActivityType } from "discord.js"
import jimp from "jimp"
import fs from "fs"
import {exec} from "child_process"
export const client = new Discord.Client({
    intents: "130815",
})

const ownerID = '<owner user id>', testingserverID = '<server id>'

let queue = [], queueBlock = false

const regexes = {
    "url": /https?:\/\/[^\s]+/g,
}
/**
 * 
 * @param {String} code 
 * @param {String} filename 
 * @param {jimp} image 
 * @returns 
 */
async function generateImage(code, filename, image) {
    return new Promise((resolve,reject) => {
        exec(`ffmpeg -i ${filename} -i a.gif -filter_complex "overlay=${Math.round(image.bitmap.width/2-26)}:${image.bitmap.height-Math.round(image.bitmap.height/2/2)-38}" ./images/${code}.gif`, (error, stdout, stderr) => {
            if (error) {
                logs.error(error)
                return reject(error)
            }
            let buffer = fs.readFileSync(`./images/${code}.gif`)
            fs.unlinkSync(`./images/${code}.gif`)
            fs.unlinkSync(`./images/${code}.${image.getExtension()}`)
            resolve(buffer)
        })
    })
}
function generateCode() {
    let code = ""
    for (let i = 0; i < 6; i++) {
        code += Math.floor(Math.random() * 10)
    }
    return code
}

const logs = {
    "log": (message) => {
        console.log(`[${new Date().toLocaleString()}] ${message}`)
        if(!fs.existsSync(`./logs/${new Date().toLocaleDateString().replace(/\//g, "-")}.log`)) fs.writeFileSync(`./logs/${new Date().toLocaleDateString().replace(/\//g, "-")}.log`, '')
        fs.appendFileSync(`./logs/${new Date().toLocaleDateString().replace(/\//g, "-")}.log`, `[${new Date().toLocaleString()}] ${message}\n`)
    },
    "error": async (message, server=null) => {
        console.error(`[${new Date().toLocaleString()}] ${message}`)
        if(!fs.existsSync(`./logs/${new Date().toLocaleDateString().replace(/\//g, "-")}.log`)) fs.writeFileSync(`./logs/${new Date().toLocaleDateString().replace(/\//g, "-")}.log`, '')
        fs.appendFileSync(`./logs/${new Date().toLocaleDateString().replace(/\//g, "-")}.log`, `[ERROR] [${new Date().toLocaleString()}] ${message}\n`)
        let logchannel = await client.channels.fetch(settings.get('logsChannelID')),
        embed = new Discord.EmbedBuilder()
        .setTitle("❌ Error")
        .setDescription("```" + message + "```")
        .setColor(Discord.Colors.Red)
        .setTimestamp()
        logchannel.send({embeds: [embed], content: `<@&1032674463118000258> Error found ${server ? `on ${server.name} (${server.id})` : ""}!`})
    }
}

const abusers = {
    get: (type,id) => {
        let list = JSON.parse(fs.readFileSync("./abusers.json"))
        if(!list[type]) return false;
        return list[type].includes(id)
    },
    add: (type,id) => {
        let list = JSON.parse(fs.readFileSync("./abusers.json"))
        if(!list[type]) return null;
        list[type].push(id)
        fs.writeFileSync("./abusers.json",JSON.stringify(list))
    },
    remove: (type,id) => {
        let list = JSON.parse(fs.readFileSync("./abusers.json"))
        if(!list[type]) return null;
        list[type] = list[type].filter(x => x !== id)
        fs.writeFileSync("./abusers.json",JSON.stringify(list))
    }
}

const settings = {
    get: (option) => {
        let list = JSON.parse(fs.readFileSync("./settings.json"))
        if(!list[option]) return null;
        return list[option]
    },
    set: (option,value) => {
        let list = JSON.parse(fs.readFileSync("./settings.json"))
        if(!list[option]) return null;
        list[option] = value
        fs.writeFileSync("./settings.json",JSON.stringify(list))
    }
}

let cmds = {}

cmds["toggleGen"] = {
    ownerOnly: true,
    usage: ">toggleGen",
    exec: async (msg, args) => {
        queueBlock = !queueBlock
        msg.channel.send(`Queue is now \`${queueBlock ? "✅ blocked" : "❎ unblocked"}\``)
    }
}

cmds["block"] = {
    ownerOnly: true,
    usage: ">block <user/server> <id>",
    exec: async (msg,args) => {
        if(args.length < 2) return msg.reply(">block <user/server> <id> [reason]")
        let choice = args[0],
            id = args[1],
            reason = args.slice(2).join(" ") || "No reason provided"
        if((id == testingserverID && choice == 'server') || (id == ownerID && choice == 'user')) return msg.reply("bro 💀")
        if(!["user","server"].includes(choice)) return msg.reply("Invalid choice");
        if(!id) return msg.reply("Invalid id");
        if(abusers.get(choice,id)) return msg.reply(`This ${choice} is already blocked`);
        abusers.add(choice,id)
        msg.reply(`Successfully blocked ${choice} (${id}) for reason: \`${reason}\``)
        logs.error(`Blocked ${choice} (${id}) for reason: ${reason}`)
    }
}

cmds["unblock"] = {
    ownerOnly: true,
    usage: ">unblock <user/server> <id>",
    exec: async (msg,args) => {
        if(args.length < 2) return msg.reply(">unblock <user/server> <id>")
        let choice = args[0].toLowerCase(),
            id = args[1]
        if(!["user","server"].includes(choice)) return msg.reply("Invalid choice");
        if(!id) return msg.reply("Invalid id");
        if(!abusers.get(choice,id)) return msg.reply(`This ${choice} is not blocked`);
        abusers.remove(choice,id)
        msg.reply(`Successfully unblocked ${choice} (${id})`)
        logs.error(`Unblocked ${choice} (${id})`)
    }
}

cmds["help"] = {
    usage: ">help",
    exec: async (msg,args) => {
        let embed = new Discord.EmbedBuilder()
        .setTitle("Commands")
        .setColor(Discord.Colors.Blue)
        .setDescription(`${Object.keys(cmds).map(x => {
            if(cmds[x].ownerOnly && msg.author.id !== ownerID) return null;
            return `**>${x}** | \`${cmds[x].usage}\``
        }).filter(x => x!==null).join("\n")}\n\nFor more info, join [support server](https://discord.gg/DnE2ZDyrJ6)`)
        msg.reply({embeds: [embed]})
    }
}


cmds["set"] = {
    ownerOnly: true,
    usage: ">set <option> <value>",
    exec: async (msg,args) => {
        if(args.length < 2) return msg.reply(">set <option> <value>")
        let option = args[0],
            value = args.slice(1).join(" "),
            oldvalue = settings.get(option) || "[NONE]"
        settings.set(option,value)
        let sentMsg = await msg.reply({
            "embeds": [new Discord.EmbedBuilder({
                "title": "Updated!",
                "description": `**Option:** ${option}\n\n \`❌ Old value:\` \`\`\`${oldvalue}\`\`\`\n \`✅ New value:\` \`\`\`${value}\`\`\``
            })]
        })
        setTimeout(() => {
            sentMsg.delete()
            msg.delete()
        }, 2000);
    }
}

setInterval(() => {
    queueCounter = {}
}, 20000);
let queueCounter = {}
cmds["generate"] = {
    usage: ">generate [link (if no image attached)]",
    exec: async (msg, args) => {
        let image,error,result;
        if(queueBlock && msg.author.id !== ownerID) return msg.reply("<:no:1032375685186072636> Queue is **blocked** now. Please wait.")
        if(queue.length > 3) {
            msg.reply("<:no:1032375685186072636> The queue is **full**, please wait a bit.")
            queueCounter[msg.author.id] = queueCounter[msg.author.id] ? queueCounter[msg.author.id] + 1 : 1;
            return;
        }
        if(queue.includes(msg.author.id)) {
            msg.reply("You are already in the queue!")
            queueCounter[msg.author.id] = queueCounter[msg.author.id] ? queueCounter[msg.author.id] + 1 : 1;
            return;
        }
        if(msg.attachments.size == 0 && !(args.length > 0 || regexes.url.test(args[0]))) return msg.reply("<:no:1032375685186072636> `Please attach an image or provide a link to an image.`")
        queue.push(msg.author.id)

        let statusMSG = await msg.reply("<a:typing:1032374529936326716> **Generating...**");
        try{
            image =  await jimp.read(args[0] || msg.attachments.first()?.url || "");
            if(!["png","jpg","jpeg"].includes(image.getExtension())) return statusMSG.edit("<:no:1032375685186072636> `Invalid image format.`")
            //save image
            let code = generateCode();
            image.scaleToFit(500,500).write(`./images/${code}.${image.getExtension()}`)
            result = await generateImage(code, `./images/${code}.${image.getExtension()}`, image)
        }catch(err){
            error = true
            logs.error(err)
        }
        queue.splice(queue.indexOf(msg.author.id),1)
        if (error) return statusMSG.edit("<:no:1032375685186072636> Something went wrong while generating the image, please try again later.")
        if(!result) return statusMSG.edit("<:no:1032375685186072636> Something went wrong, you may have **provided an invalid image**.")
        await statusMSG.edit({content: "<a:yes:1032375683336380497> Done!", files: [
            {"attachment": result, "name": "EverythingHumped.gif"}
        ]})
        logs.log(`Image generated and sent for ${msg.author.tag} (${msg.author.id}) in ${msg.guild.name} (${msg.guild.id})`)
    }
}

process.on("uncaughtException", (err) => {
    logs.error(err)
})

client.on('error', (err) => {
    logs.error(err)
})

client.on("ready", () => {
    client.user.setActivity({
        "name": "meow",
        "type": ActivityType.Competing
    })
    console.clear();
    console.log(`${client.user.tag} is ready!`)
})

client.on("messageCreate", (message) => {
    if(!message.content.startsWith(">")) return;
    if(message.author.bot) return;
    let args = message.content.split(" "),
        command = args.shift().slice(1);

    if(abusers.get("user",message.author.id)) return message.reply("You are blocked from using this bot. For more info, contact the owner.")
    if(abusers.get("server",message.guild.id)) {
        message.reply("This server has been blocked from using this bot. If you want to unblock it, please contact the owner. In the meantime bot will leave this server.")
        return message.guild.leave()
    }



    if(cmds[command]) {
        if(cmds[command].ownerOnly && message.author.id !== ownerID) return message.reply("`👮 This command is owner only.`")
        logs.log(`Command ${command} used by ${message.author.tag} (${message.author.id}) in ${message.guild.name} (${message.guild.id}) | Arguments (if any): ${args.join(" ||| ")}`)
        if(queueCounter[message.author.id] > 3) logs.error(`User ${message.author.tag} (${message.author.id}) has been detected as a spammer.`, message.guild)
        return cmds[command].exec(message, args)
    }
    return message.react("❌");

        
})


client.login("<token>");
