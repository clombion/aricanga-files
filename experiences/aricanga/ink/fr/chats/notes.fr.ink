// Mes Notes - Mémos vocaux, rappels et notes de recherche

=== notes_chat ===
~ current_chat = "notes"

// Seed messages - generated on first visit, persisted in message history
// Time tags here are display-only (before # story_start)
{notes_chat == 1:
    # type:sent
    # time:Mar 1
    Tuyau de Pat sur l'autorité portuaire — vérifier les allocations budgétaires pour le nouveau terminal. Source dit dans les prochaines semaines.

    ~ delay_next(0)
    # type:sent
    # time:Mar 4
    Contact ministère : poste 4421

    ~ delay_next(0)
    # type:sent
    # time:Mar 8
    # linkUrl:resourcegovernance.org
    # linkDomain:resourcegovernance.org
    # linkTitle:Natural Resource Governance Institute
    # linkDesc:Données et analyses sur la gouvernance du pétrole, du gaz et des minerais dans le monde
    # linkLayout:minimal
    À garder pour le suivi des industries extractives. Bonnes données de référence.

    ~ delay_next(0)
    # type:sent
    # time:Mar 10
    Suivi de l'extension du port terminé. Pat est content. Le contact à l'autorité portuaire pourrait être utile pour l'article sur le terminal.

    ~ delay_next(0)
    # type:sent
    # time:Mar 12
    Conférence de presse demain matin — accord {name("aricanga", "short")}. Revoir les notes de contexte ce soir.
}

# story_start

{not player_agreed:
    -> notes_chat.empty
}

{player_agreed and not research_complete:
    -> notes_chat.research_phase
}

{research_complete and draft_sent:
    -> notes_chat.ready_to_write
}

-> DONE

= empty
# type:system
Pas encore de notes.
-> DONE

= research_phase
~ research_started = true

# type:sent
# audio:/assets/audio/memo-001.m4a
# duration:0:08
# time:9:15 AM
Je reviens de la conférence de presse. Pat veut l'article sur {name("aricanga", "short")} pour ce soir. Couverture standard — partir du dossier de presse de Jean-Marc, obtenir un commentaire du {name("ministry", "short")} si possible.

~ delay_next(1000)
# type:sent
Vérifier aussi s'il y a des données utiles pour comparer avec les affirmations du {name("ministry", "short")}. Les bases de données de ((gouvernance des ressources::glossary:resource-governance)) pourraient avoir quelque chose.

~ delay_next(1200)
# type:sent
Qui pourrait en savoir plus sur {name("aricanga", "alt")} ?

* [{name("ministry", "reference")} uniquement - s'en tenir aux sources officielles]
    # type:sent
    Contact au {name("ministry", "reference")} d'abord. Rester simple.

    -> notes_chat.continue_research

* [Contacter aussi {name("activist", "display_name")}]
    # type:sent
    {name("activist", "first_name")} pourrait savoir quelque chose — elle suit tous les accords de l'industrie extractive.

    ~ can_request_activist_comment = true

    ~ delay_next(600)
    # type:sent
    Je la contacte aussi.

    -> notes_chat.continue_research

= continue_research
~ delay_next(800)
# type:sent
# time:9:45 AM
TODO : le numéro du service de presse du {name("ministry", "reference")} est dans le dossier contacts. Aussi revoir le dossier de presse de Jean-Marc pour les détails du ((registre des sociétés::glossary:corporate-registry)).

~ delay_next(1200)
# type:sent
# image:/assets/press-release-aricanga.svg
Communiqué de presse — points clés surlignés

~ delay_next(2500)
# type:sent
# audio:/assets/audio/memo-002.m4a
# duration:0:12
# time:10:30 AM
Appelé le {name("ministry", "short")}. Bloqué par un stagiaire. « Pas de commentaire supplémentaire pour le moment. » Classique. L'article ne sera pas mieux que ça.

~ delay_next(1200)
# type:sent
# time:10:45 AM
# linkUrl:glossary:soe-database
# linkDomain:eiti.org
# linkTitle:SOE Database
# linkDesc:Base de données de l'ITIE sur les paiements des entreprises publiques dans les industries extractives.
# linkLayout:minimal
Trouvé ceci — soe-database.eiti.org. L'((ITIE::glossary:eiti)) suit tous les paiements déclarés des entreprises publiques. Utile pour recouper les chiffres du ministère.

~ delay_next(800)
# type:sent
L'{name("eiti", "short")} montre un revenu annuel médian des projets miniers de (({data_median_revenue}::eiti:median_annual_revenue)). Le {name("ministry", "reference")} annonce (({ministry_claimed_revenue}::story:ministry_release)) pour {name("aricanga", "short")}. C'est plus du double de la médiane. Gisement plus important, ou quelqu'un gonfle les chiffres. À creuser.

~ delay_next(1000)
# type:sent
# time:11:15 AM
Brouillon prêt à envoyer.

~ research_complete = true
# targetChat:pat
# speaker:Pat
# notificationPreview:Où en es-tu avec l'article {name("aricanga", "short")} ?
Où en es-tu avec l'article {name("aricanga", "short")} ? La rédaction en a besoin rapidement.
-> DONE

= ready_to_write

# type:sent
# audio:/assets/audio/memo-003.m4a
# duration:0:18
# time:3:15 PM
En repensant à l'article {name("aricanga", "short")}... quelque chose cloche dans les chiffres de création d'emplois. Le {name("ministry", "reference")} annonce 12 000 nouveaux emplois, mais l'emprise du projet ne pourrait pas en supporter la moitié.

~ delay_next(1500)
# type:sent
Trop tard maintenant. L'article est déjà envoyé.

~ delay_next(1000)
# type:sent
À revoir si d'autres éléments apparaissent.

# targetChat:pat
# speaker:Pat
# notificationPreview:Les documents de l'autorité portuaire sont prêts
Les documents de l'autorité portuaire sont dans ta boîte mail. Allocations budgétaires pour le nouveau terminal.
-> DONE
