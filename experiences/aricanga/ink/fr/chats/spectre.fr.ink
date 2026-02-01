// Spectre - Initié gouvernemental, bureaucrate frustré

=== spectre_chat ===
~ current_chat = "spectre"

// No seed messages - Spectre hasn't contacted player yet
# story_start

{not article_published:
    -> spectre_chat.silent
}

{article_published and not spectre_contacted:
    -> spectre_chat.first_contact
}

{spectre_contacted and agreed_to_meet:
    -> spectre_chat.follow_up_agreed
}

{spectre_contacted and not agreed_to_meet:
    -> spectre_chat.follow_up_declined
}

-> spectre_chat.silent

= silent
-> DONE

// First message was sent cross-chat from pat.fr.ink
= first_contact
~ spectre_contacted = true

~ delay_next(2000)
# type:received
Je pense qu'ils ont bâclé l'((évaluation environnementale::glossary:environmental-assessment)) sur ce coup. Sûrement pour boucler les conditions avant que les investisseurs se refroidissent.

~ delay_next(2500)
# type:received
Les projections de revenus me paraissaient bizarres. J'ai vu les chiffres qu'ils utilisent pour des concessions comparables, ça colle pas.

* [Ouais j'avais le même sentiment. Pas pu creuser avec les délais.]
    # type:sent
    Ouais j'avais le même sentiment. Pas pu creuser avec les délais.

    ~ delay_next(2000)
    # speaker:TonyGov
    # type:received
    Je pourrais peut-être récupérer l'évaluation technique originale. Celle qui a été soumise avant que le ministère retouche tout.

    ~ delay_next(1500)
    # type:received
    Je promets rien, mais je vais voir ce que je trouve.

    ~ agreed_to_meet = true
    -> DONE

* [Pas eu le temps de rentrer dans tout ça. On a publié ce qu'on avait.]
    # type:sent
    Pas eu le temps de rentrer dans tout ça. On a publié ce qu'on avait.

    ~ delay_next(2500)
    # speaker:TonyGov
    # type:received
    OK. Je dis juste que le rapport de conformité ((ITIE::glossary:eiti)) a été reporté deux fois. Ça vaut peut-être le coup d'y jeter un œil.

    ~ delay_next(800)
    # presence:offline
    -> DONE

* [(Ignorer)]
    -> DONE

= follow_up_agreed
# speaker:TonyGov
# type:received
# time:6:00 PM
Bon j'ai demandé autour de moi. Je pense pouvoir récupérer une copie de l'évaluation technique originale, celle d'avant le nettoyage.

~ delay_next(1200)
# type:received
Donne-moi un jour ou deux.

~ delay_next(600)
# presence:offline
-> DONE

= follow_up_declined
# speaker:TonyGov
# type:received
# time:6:00 PM
# presence:online
Le cadre de conformité existe pour une raison. Quand vous serez prêt à comprendre pourquoi il a été contourné, contactez-moi.

~ delay_next(800)
# presence:offline
-> DONE
