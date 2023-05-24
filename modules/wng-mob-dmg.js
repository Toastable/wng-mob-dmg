Hooks.on("getChatLogEntryContext", (html, options) => {
    let canApplyMob = li => {
        let msg = game.messages.get(li.attr("data-message-id"));
        let test = msg.getTest();
        if (test && canvas.tokens.controlled.length > 0)
            return test.result.isSuccess;
    };

    options.unshift(
    {
        name: "BUTTON.ApplyDamageMob",
        icon: '<i class="fas fa-user-minus"></i>',
        condition: canApplyMob,
        callback: li => {
            let test = game.messages.get(li.attr("data-message-id")).getTest();
            canvas.tokens.controlled.forEach(t => _dealDamageToMob(test, t.actor));
        }
    });
});

function _dealDamageToMob(test, target) {
    let promise;

    if (!target || !target.mob)
        return promise;

    const successIcons = test.result.success;
    const testDn = test.result.dn;
    const targetDef = target.combat.defence.total || 1
    let targetsHit = 1;

    const additionalIconsOverDefence = (successIcons - testDn) - targetDef;

    if (additionalIconsOverDefence > 0)
        targetsHit += additionalIconsOverDefence;

    let updateObj = {}

    const remainingTargetsInMob = target.mob - targetsHit;

    updateObj["data.mob"] = remainingTargetsInMob <= 0 ? null : remainingTargetsInMob;

    if(remainingTargetsInMob <= 0) {
        updateObj["data.combat.wounds.value"] = target.combat.wounds.max;
        updateObj["data.combat.shock.value"] = target.combat.shock.max;
    }        

    ui.notifications.notify(game.i18n.format("NOTE.APPLY_DAMAGE_MOB", { number: targetsHit, name: target.prototypeToken.name }));

    target.update(updateObj);

    return promise;
}