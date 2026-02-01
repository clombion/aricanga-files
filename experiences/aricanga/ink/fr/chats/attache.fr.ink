// Jean-Marc Diallo - Attaché de presse, Ministère des Ressources Naturelles

=== attache_chat ===
~ current_chat = "attache"

// Seed messages - generated on first visit, persisted in message history
// Time tags here are display-only (before # story_start)
{attache_chat == 1:
    # type:received
    # speaker:Jean-Marc
    # time:Jan 20
    Bonjour. Le cabinet du ministre confirme le report de l'audience budgétaire au 5 mars. Calendrier mis à jour en pièce jointe.

    ~ delay_next(0)
    # type:sent
    # time:Jan 20
    Merci Jean-Marc. Une chance d'avoir un pré-briefing ?

    ~ delay_next(0)
    # type:received
    # speaker:Jean-Marc
    # time:Jan 21
    Je vérifie avec le cabinet du ministre.

    ~ delay_next(0)
    # type:received
    # speaker:Jean-Marc
    # time:Feb 10
    Pré-briefing confirmé pour le 4 mars à 14h. Salle habituelle. J'enverrai l'ordre du jour plus près de la date.

    ~ delay_next(0)
    # type:sent
    # time:Feb 10
    Parfait. J'y serai.

    ~ delay_next(0)
    # type:received
    # speaker:Jean-Marc
    # time:Mar 3
    Rappel : pré-briefing demain à 14h. Le cabinet du ministre demande aux participants de réserver les questions sur le partenariat {name("aricanga", "short")} pour la conférence de presse officielle du 15.
}

# story_start

// Gate: requires player to have agreed and seen announcement
{not player_agreed: -> DONE}
{not seen_announcement: -> DONE}

// Post-publish: Jean-Marc réagit à l'article
{article_published and attache_chat > 1 and not attache_post_publish_done: -> attache_chat.post_publish}

// Only show main content once
{attache_chat > 1 and press_file_received: -> DONE}
{attache_chat > 1 and not press_file_received: -> attache_chat.press_file}

-> attache_chat.press_file

= press_file
// Connection switch: player arrives home, wifi kicks in
# status:internet:wifi2
# status:signal:3

~ arrived_home = true

// First message already sent via cross-chat from Pat's ask_angle
~ delay_next(600)
# speaker:Jean-Marc
# type:received
# attachment:/assets/docs/aricanga-press-kit.pdf
Le dossier comprend les termes complets du partenariat, les divulgations de ((bénéficiaire effectif::glossary:beneficial-ownership)) et les remarques préparées du ministre.

~ delay_next(400)
# type:received
N'hésitez pas si vous avez besoin d'autre chose pour votre article.

* [Merci Jean-Marc. C'est très utile.]
    # type:sent
    Merci Jean-Marc. C'est très utile. Je reviendrai vers vous si j'ai des questions.

    ~ press_file_received = true

    ~ delay_next(600)
    # speaker:Jean-Marc
    # type:received
    Bien sûr. Bon courage pour l'article.
    -> DONE

* [Le ministre pourrait-il faire une déclaration supplémentaire ?]
    # type:sent
    Le ministre pourrait-il faire une déclaration supplémentaire ? Quelque chose au-delà des remarques préparées.

    ~ press_file_received = true

    ~ delay_next(1500)
    # speaker:Jean-Marc
    # type:received
    Je transmets la demande, mais je ne compterais pas dessus aujourd'hui. L'agenda du ministre est chargé.

    ~ delay_next(800)
    # type:received
    Si quelque chose se débloque, je vous l'envoie immédiatement.
    -> DONE

// Réaction positive de Jean-Marc après publication de l'article
// Premier message envoyé cross-chat depuis pat.fr.ink
= post_publish
~ attache_post_publish_done = true

~ delay_next(2000)
# speaker:Jean-Marc
# type:received
Le cabinet du ministre est content de la couverture. Équilibré, factuel. C'est tout ce qu'ils demandent.

~ delay_next(1800)
# type:received
Entre nous, il y avait un peu de nervosité sur la réception. Vous leur avez facilité la tâche.

* [Tant mieux. J'ai juste rapporté ce qu'il y avait dans le dossier.]
    # type:sent
    Tant mieux. J'ai juste rapporté ce qu'il y avait dans le dossier.

    ~ delay_next(1200)
    # speaker:Jean-Marc
    # type:received
    Parfait.
    -> DONE

* [Merci Jean-Marc. Vous prévoyez une suite avec plus de détails sur les chiffres ?]
    # type:sent
    Merci Jean-Marc. Vous prévoyez une suite avec plus de détails sur les chiffres ?

    ~ delay_next(1500)
    # speaker:Jean-Marc
    # type:received
    Rien de prévu pour l'instant. Mais je vous tiens au courant si quelque chose sort.
    -> DONE
