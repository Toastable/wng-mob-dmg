Hooks.on("init", () => {
    game.settings.register('wng-mob-dmg', 'allow-psychic-tests', {
        name: 'Allow Psychic Test Damage',
        hint: 'Whether or not to allow non Multi-Target Psychic abilities to do damage to Mobs',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        requiresReload: true
    });
});

//Adapted from https://github.com/moo-man/WrathAndGlory-FoundryVTT/blob/master/scripts/common/overrides.js 
Hooks.on("wng-mob-update", (token, actor) => {
    if (actor && actor.type == "threat" && actor.isMob)
    {
      if (token.mobNumber) 
        token.mobNumber.destroy()
      token.mobNumber =  new PIXI.Container()
      let style = token._getTextStyle()
      style._fontSize = (token.h/token.w * token.h) * 0.25 
      token.mobNumber.addChild(new PreciseText(actor.mob, style))
      //this.mobNumber.zIndex = 10
      token.mobNumber.position.set(token.w-(token.w * 0.3), token.h-(token.h * 0.3))
      token.addChild(token.mobNumber)
    }
    else if (token.mobNumber)
    {
        token.mobNumber.destroy() 
    }
})

Hooks.on("getChatLogEntryContext", (html, options) => {
    let canApplyMob = li => {
        let msg = game.messages.get(li.attr("data-message-id"));
        let test = msg.getTest();

        if(!test)
            return false;
           
        const isPsychicTest = _checkIfPsychicPowerTest(test);
        const allowPsychicTests = game.settings.get('wng-mob-dmg','allow-psychic-tests');

        if(!test.damageRoll)
            return false;

        if(isPsychicTest && !allowPsychicTests)
            return false;

        const hasTarget = canvas.tokens.controlled.length > 0;
        const targetIsMob = hasTarget ? _checkIfActorIsMob(canvas.tokens.controlled[0]) : false;

        if (hasTarget && targetIsMob) {
            return test.result.isSuccess;
        }
    };

    options.unshift(
    {
        name: "BUTTON.ApplyDamageMob",
        icon: '<i class="fas fa-user-minus"></i>',
        condition: canApplyMob,
        callback: li => {
            let test = game.messages.get(li.attr("data-message-id")).getTest();
            canvas.tokens.controlled.forEach(t => {
                _dealDamageToMob(test, t.actor);
            });
        }
    });
});

function _getActorById(actorId) {
    return game.actors.filter(x => x.id === actorId)[0];
} 

function _checkIfActorIsMob(token) {
    return token.actor.mob != undefined;
}

function _checkIfPsychicPowerTest(test) {
    return test.data.context.rollClass === "PowerTest";
}

function _dealDamageToMob(test, target) {
    const successIcons = test.result.success;
    const targetDef = target.combat.defence.total || 1
    const targetResilience = target.combat.resilience.total || 1;

    const actor = _getActorById(test.data.context.speaker.actor);
    const isPsychicTest = _checkIfPsychicPowerTest(test);
    
    //TO-DO: Account for Mortal Wounds and shock
    if(targetResilience > test.result.damage.total) {
        return;
    }

    let targetsHit = 1;

    if(isPsychicTest) {
        if(!test.power.system.multiTarget) {
            targetsHit = actor.attributes.willpower.total / 2;
        }
    } else {
        const additionalIconsOverDefence = successIcons - targetDef;

        if (additionalIconsOverDefence > 0)
            targetsHit += additionalIconsOverDefence;
    }

    let updateObj = {}

    let remainingTargetsInMob = (target.mob - targetsHit);
   
    if(remainingTargetsInMob <= 0) {
        remainingTargetsInMob = null;
    }

    updateObj["system.mob"] = remainingTargetsInMob;

    if(!remainingTargetsInMob) {
        updateObj["system.combat.wounds.value"] = target.combat.wounds.max;
        updateObj["system.combat.shock.value"] = target.combat.shock.max;
    }        

    ui.notifications.notify(game.i18n.format("NOTE.APPLY_DAMAGE_MOB", { number: targetsHit, name: target.prototypeToken.name }));

    target.update(updateObj);

    const token = canvas.tokens.placeables.find(t => {
        return t.actor.id === target.id
    });

    Hooks.call("wng-mob-update", token, { type: target.type, isMob: target.isMob, mob: remainingTargetsInMob });
}