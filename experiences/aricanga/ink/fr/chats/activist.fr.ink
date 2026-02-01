// Maria Santos - Militante communautaire
// Suit les accords de l'industrie extractive, ton articulé d'organisatrice

=== activist_chat ===
~ current_chat = "activist"

// Seed messages - generated on first visit, persisted in message history
// Time tags here are display-only (before # story_start)
{activist_chat == 1:
    # type:received
    # speaker:Maria
    # time:Jul 15
    Ravie de pouvoir échanger enfin. J'ai appris que vous avez couvert l'extension du port.

    ~ delay_next(0)
    # type:sent
    # time:Jul 15
    Oui, difficile de trouver des sources là-dessus. Vous êtes impliquée dans la coalition ?

    ~ delay_next(0)
    # type:received
    # speaker:Maria
    # time:Jul 15
    De près. On suit tous les accords de l'industrie extractive dans la région. L'extension du port a des implications pour les communautés côtières.

    ~ delay_next(0)
    # type:sent
    # time:Jul 16
    Ce point de vue m'intéresse. L'essentiel de ce que j'entends vient du côté de l'autorité portuaire.

    ~ delay_next(0)
    # type:received
    # speaker:Maria
    # time:Jul 16
    C'est bien le problème. Les communautés affectées sont rarement consultées. N'hésitez pas si vous avez besoin de contexte sur ces accords.

    ~ delay_next(0)
    # type:received
    # speaker:Maria
    # time:Aug 20
    # linkUrl:globalwitness.org/en/
    # linkDomain:globalwitness.org
    # linkTitle:Global Witness
    # linkDesc:Nous révélons comment les industries qui alimentent la crise climatique profitent de la destruction, et nous soutenons les populations qui résistent
    # linkImage:assets/global-witness-logo.png
    # linkLayout:card
    Le dernier rapport de Global Witness. Les mêmes schémas qu'ici — évaluations bâclées, structures de propriété opaques. À lire.

    ~ delay_next(0)
    # type:sent
    # time:Aug 20
    Merci pour le partage. Je vais le lire.

    ~ delay_next(0)
    # type:received
    # speaker:Maria
    # time:Sep 5
    Réunion communautaire hier sur les propositions pour la Province Nord. Soixante personnes présentes. Les gens sont attentifs.

    ~ delay_next(0)
    # type:sent
    # time:Sep 5
    Belle participation. Des points essentiels à retenir ?

    ~ delay_next(0)
    # type:received
    # speaker:Maria
    # time:Sep 5
    La principale préoccupation concerne les droits fonciers. Les cartes de concession chevauchent trois villages et des terres agricoles coutumières. Personne n'a été officiellement notifié.
}

# story_start

{article_published and not activist_comment_requested:
    {can_request_activist_comment:
        -> activist_chat.missed_with_note
    }
    -> activist_chat.missed_without_note
}

{not can_request_activist_comment:
    -> activist_chat.dormant
}

{can_request_activist_comment and not activist_comment_requested:
    -> activist_chat.can_ask
}

{activist_comment_requested and not activist_responded:
    -> activist_chat.waiting
}

{activist_responded:
    -> activist_chat.post_publication
}

-> activist_chat.dormant

= dormant
-> DONE

= can_ask
# type:system
Vous pouvez demander à {name("activist", "first_name")} à propos de {name("aricanga", "alt")}.

* [Demander à propos de {name("aricanga", "alt")}]
    # type:sent
    # time:10:15 AM
    Salut {name("activist", "first_name")}, petite question. Tu sais quelque chose sur {name("aricanga", "alt")} ? Il y a une annonce officielle ce matin.

    ~ activist_comment_requested = true

    ~ delay_next(2000)
    # speaker:Maria
    # type:received

    ~ delay_next(2500)
    # type:received
    {name("aricanga", "short")} ? Oui, ils sont sur notre radar depuis un moment.

    ~ delay_next(1500)
    # type:received
    Leurs évaluations environnementales dans les provinces du sud étaient incomplètes au mieux. La coalition les suit depuis qu'ils ont obtenu le ((permis minier::glossary:mining-license)).

    ~ delay_next(2000)
    # type:received
    Je peux chercher les détails si tu veux. C'est quoi ton délai ?

    * * [Urgent - je publie aujourd'hui]
        # type:sent
        Je publie aujourd'hui, malheureusement. Ce que tu peux trouver rapidement.

        ~ delay_next(1500)
        # speaker:Maria
        # type:received
        C'est très court comme délai.

        ~ delay_next(1200)
        # type:received
        Je vais voir ce que je peux rassembler, mais je ne promets rien.

        ~ delay_next(800)
        # type:received
        Les communautés méritent une voix dans ces articles.

        -> DONE

    * * [Juste du contexte pour l'instant]
        # type:sent
        Juste du contexte pour l'instant. En off.

        ~ delay_next(1800)
        # speaker:Maria
        # type:received
        La coalition suit leurs opérations depuis l'obtention du ((permis minier::glossary:mining-license)).

        ~ delay_next(1500)
        # type:received
        Émissions sous-déclarées, pratiques de travail douteuses. ((Enregistrements offshore::glossary:offshore-company)) via trois juridictions.

        ~ delay_next(1200)
        # type:received
        Mais le prouver nécessite un accès que nous n'avons pas encore.

        -> DONE

* [(Pas maintenant)]
    -> DONE

= missed_with_note
# speaker:Maria
# type:received
~ delay_next(1500)
Je suis déçue que vous ne nous ayez pas contactés pour un commentaire.

~ delay_next(1500)
# type:received
Les communautés affectées méritent une voix dans ces articles.

* [Désolé - je l'avais noté mais j'ai oublié dans la précipitation]
    # type:sent
    Je suis vraiment désolé. J'avais noté de vous contacter mais j'ai été emporté par le délai.

    ~ delay_next(1500)
    # speaker:Maria
    # type:received
    J'apprécie que vous le disiez. La prochaine fois, faites-en une priorité.
    -> DONE

* [C'est ma faute - je dois faire mieux]
    # type:sent
    Vous avez raison. C'est entièrement ma faute. Je dois faire mieux.

    ~ delay_next(1500)
    # speaker:Maria
    # type:received
    J'apprécie. La porte est ouverte pour un article de suivi.
    -> DONE

= missed_without_note
# speaker:Maria
# type:received
~ delay_next(1500)
Je suis déçue que vous ne nous ayez pas contactés pour un commentaire.

~ delay_next(1500)
# type:received
Les communautés affectées méritent une voix dans ces articles.

* [Je n'y ai pas pensé - je ferai mieux la prochaine fois]
    # type:sent
    Je n'y ai pas pensé. Je m'assurerai d'inclure les voix des communautés la prochaine fois.

    ~ delay_next(1500)
    # speaker:Maria
    # type:received
    Merci. Nous sommes toujours disposés à aider les journalistes à raconter l'histoire complète.
    -> DONE

* [Le délai était très serré]
    # type:sent
    Le délai était vraiment serré. J'ai dû travailler avec ce que j'avais.

    ~ delay_next(1500)
    # speaker:Maria
    # type:received
    Les délais serrés profitent souvent à ceux qui ont les ressources pour répondre vite.

    ~ delay_next(1000)
    # type:received
    Les groupes communautaires n'ont pas de services de presse en attente.
    -> DONE

= waiting
# speaker:Maria
# type:received
# time:11:30 AM
Je cherche encore sur {name("aricanga", "short")}. Leur structure corporative est complexe.

~ delay_next(1000)
# type:received
Multiples filiales. ((Enregistrements offshore::glossary:offshore-company)). Ça prend du temps à tracer.

~ delay_next(800)
# type:received
J'aurai plus d'informations bientôt.

-> DONE

= post_publication
# speaker:Maria
# type:received
~ delay_next(2000)
Je comprends la pression des délais, mais je dois être directe avec vous.

~ delay_next(2500)
# type:received
Les groupes communautaires affectés par cet accord n'ont pas eu le temps de répondre.

~ delay_next(2000)
# type:received
Votre article manque un contexte crucial sur les évaluations environnementales qui n'ont jamais été correctement complétées.

~ delay_next(1500)
# type:received
Je ne vous blâme pas personnellement. Je sais comment fonctionnent les rédactions.

~ delay_next(2000)
# type:received
Mais ce sont de vraies communautés. De vraies personnes qui seront affectées.

* [Je suis désolé - qu'est-ce que j'ai manqué ?]
    # type:sent
    Je suis désolé. Qu'est-ce que j'ai manqué exactement ?

    ~ delay_next(2500)
    # speaker:Maria
    # type:received
    Le cadrage « investissement historique » vient directement du communiqué de presse du ministère.

    ~ delay_next(1500)
    # type:received
    Aucune mention des évaluations environnementales incomplètes. Aucune mention des litiges fonciers.

    ~ delay_next(2000)
    # type:received
    J'ai de la documentation sur les lacunes de ((transparence extractive::glossary:transparency)). Si vous êtes disposé à faire un article de suivi, je peux aider.

    ~ delay_next(1200)
    # type:received
    Mais la prochaine fois, donnez-nous plus que quelques heures.

    -> DONE

* [J'ai dû travailler avec ce que j'avais]
    # type:sent
    J'ai dû travailler avec ce que j'avais. Le délai était serré.

    ~ delay_next(2000)
    # speaker:Maria
    # type:received
    Je comprends. Mais les délais serrés profitent souvent à ceux qui ont les ressources pour répondre rapidement.

    ~ delay_next(1800)
    # type:received
    Les groupes communautaires n'ont pas de services de presse en attente.

    ~ delay_next(1500)
    # type:received
    La porte est ouverte si vous voulez raconter l'histoire complète plus tard.

    -> DONE

* [(Lire plus tard)]
    -> DONE
