/*
 * Describes an "affect", something that temporarily (or sometimes,
 * permanently) modifies a characteristic of an actor. (Usually in the form of
 * a buff spell)
 *
 * An affect has two phases
 *
 * 1) Activation: the player casts a spell or does something to activate the
 *    buff, debuff, or whatever. The activation function is passed two
 *    arguments: the actor and whether the actor already has the affect. The
 *    latter is passed because usually you don't want to apply the affect
 *    twice, you just want to extend the duration.
 *
 * 2) Deactivation: the affect wears off. This function should undo whatever
 *    the activation function did. (Or not, which results in a permanent
 *    affect.)
 *    
 * 
 * Only the Affect.addAffect(actor, affectName) function should be used to
 * add affects to actors. All possible affects (referred to by affectName)
 * should be defined in the object Affect.affects.
 */

define([], function() {
  /*
   * There are two rules to writing affects:
   *
   * The activate and deactivate functions *usually* should be inverses of each
   * other unless there is a desired side effect.  For example, if you have a
   * "strength" affect and activate does +2 str, deactivate should do -2 str.
   *
   * Another rule: DON'T MIX DIFFERENT KINDS OF OPERATIONS. if you have an
   * affect that adds to str and removes from str, EVERY affect must only ADD
   * and SUBTRACT str (or leave it) same. To see why, imagine affects A and B.
   * A grants +2 str and B doubles str and both reverse their effect properly.
   * The player has 15 str and activates A, giving him 17 str. Now, he
   * activates B and has 34 str. Affect A runs out, so he is left with only 32
   * str, and affect B runs out, leaving him with 16 str, erroneously gaining a
   * point of str in the process. You cannot mix multiplication and addition
   * unless you can 100% guarantee that the options will expire like a stack:
   * gain A, gain B, lose B, lose A (this guarantee is unlikely).
   */
  var Affect = function(game, options) {
    this.name = options.name;
    this.duration = options.duration;

    this.activate = options.activate;

    // If options.deactivate is not provided, nothing will happen when the
    // timer runs out; the affect is permanent.
    this.deactivate = options.deactivate || null;
    this.permanent = !options.deactivate;
    

    // This will be the affect's timer which the affect can then modify to
    // increase its own duration (like if it's reactivated)
    this.timer = null;
  };

  Affect.prototype.applyTo = function(actor) {
    var alreadyHasAffect = actor.affects.indexOf(this.name) > -1;
    this.activate(actor, alreadyHasAffect);

    if (!alreadyHasAffect && !this.permanent) {
      actor.affects.push(this.name);
    }

    if (!this.permanent) {

      // Inner functions mess with "this", so have to alias it to be able to
      // access "this" within the callback.
      var _this = this;

      this.timer = game.setTimer(duration, function() {
        _this.deactivate(actor);

        var index = actor.affects.indexOf(_this.name);
        if (index > -1) {
          actor.affects.splice(index, 1);
        }
      });

    }

  };

  // This is the function that should be used to add affects to actors.
  Affect.addAffect = function(actor, affectName) {
    var affectOptions = Affect.affects[affectName];
    if (!affectOptions) {
      throw {
        name: "InvalidAffectName",
        message: "Invalid affect name: " + affectName
      };
    }

    var affect = new Affect(affectOption);
    affect.applyTo(actor);
    return true;
  };

  // Stores all the affects that can be used.
  Affect.affects = {
    strength: {
      name: "strength",
      description: "small temporary boost to strength",
      duration: 200,
      activate: function(actor, repeat) {
        if (repeat) {
          // The actor already has the 'strength' affect
          this.timer.ticksLeft += Affects.affects.strength.duration;
        } else {
          actor.stats.str += 2;
        }
      },
      deactivate: function(actor) {
        actor.stats.str -= 2;
      }
    },
  };

  return Affect;


});
