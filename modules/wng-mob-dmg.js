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

    game.settings.register('wng-mob-dmg', 'allow-flamer-tests', {
        name: 'Allow Flamer Weapon Damage',
        hint: 'Whether or not to allow weapons with the Flamer trait to do damage to Mobs',
        scope: 'world',
        config: true,
        type: Boolean,
        default: false,
        requiresReload: true
    });
});

Hooks.on("refreshToken", (token) => token.drawMobNumber())

Hooks.on("getChatLogEntryContext", (html, options) => {
    let canApplyMob = li => {
        let msg = game.messages.get(li.attr("data-message-id"));
        let test = msg.getTest();

        if(!test)
            return false;
           
        const isPsychicTest = _checkIfPsychicPowerTest(test);
        const allowPsychicTests = game.settings.get('wng-mob-dmg','allow-psychic-tests');

        const isFlamerTest = _checkIfWeaponIsFlamer(test);
        const allowFlamerTests = game.settings.get('wng-mob-dmg','allow-flamer-tests');

        if(!test.damageRoll)
            return false;

        if(isPsychicTest && !allowPsychicTests)
            return false;

        if(isFlamerTest && !allowFlamerTests)
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

function _getBlastRatingForWeapon(item) {
    return item?.traits?.list?.filter(t => t.name === "blast")[0].rating;
}

function _checkIfActorIsMob(token) {
    return token.actor.mob != undefined;
}

function _checkIfPsychicPowerTest(test) {
    return test.context.rollClass === "PowerTest";
}

function _checkIfWeaponIsGrenadeOrMissile(test) {
    return test.item.system.category === "grenade-missile";
}

function _checkIfDamageDealsMortalWounds(damage) {
    return damage?.other?.mortalWounds?.total || damage?.other?.mortalWounds?.total > 0;
}

function _checkIfWeaponIsFlamer(test) {
    return test.item?.traits?.list?.some(t => t.name === "flamer");
}

function _dealDamageToMob(test, target) {
    const successIcons = test.result.success;
    const targetDef = target.combat.defence.total || 1
    const targetResilience = target.combat.resilience.total || 1;

    const actor = test.actor;
    const isPsychicTest = _checkIfPsychicPowerTest(test);
    const isGrenadeOrMissile = _checkIfWeaponIsGrenadeOrMissile(test);
    
    //TO-DO: Account for shock
    if(!_checkIfDamageDealsMortalWounds(test.result.damage)) {
        if(targetResilience > test.result.damage.total) {
            return;
        }
    }

    let targetsHit = 1;

    if(isPsychicTest) {
        if(!test.power.system.multiTarget) {
            targetsHit = Math.round(actor.attributes.willpower.total / 2);
        }
    } else if (isGrenadeOrMissile) {
        const blastRating = _getBlastRatingForWeapon(test.item);
        targetsHit = blastRating / 2;
    } else if(_checkIfWeaponIsFlamer(test)) {
        targetsHit = Math.round(actor.attributes.agility.total / 2);
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

    const notifyMessageFormat = targetsHit > 1 ? "NOTE.APPLY_DAMAGE_MOB" : "NOTE.APPLY_DAMAGE_MOB_SINGLE";
    ui.notifications.notify(game.i18n.format(notifyMessageFormat, { number: targetsHit, name: target.prototypeToken.name }));

    target.update(updateObj);
}