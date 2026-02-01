// Pat (Rédacteur) - Votre chef au Chronicle

=== pat_chat ===
~ current_chat = "pat"

// Seed messages - generated on first visit, persisted in message history
// Time tags here are display-only (before # story_start)
{pat_chat == 1:
    # date:-7
    # type:received
    # speaker:Pat
    # time:Feb 15
    L'article sur l'extension du port a besoin de 500 mots de plus. La rédaction veut plus de détails sur les permis environnementaux.

    ~ delay_next(0)
    # type:sent
    # time:Feb 15
    J'y travaille. Ma source à l'autorité portuaire est évasive mais je vais insister.

    ~ delay_next(0)
    # type:received
    # speaker:Pat
    # time:Feb 15
    Insiste davantage. On a enterré l'essentiel la dernière fois sur le financement du terminal.

    ~ delay_next(0)
    # date:-5
    # type:sent
    # time:Feb 22
    Article sur le port envoyé. La source a fini par parler — l'autorité portuaire a confirmé le déficit budgétaire en off.

    ~ delay_next(0)
    # type:received
    # speaker:Pat
    # time:Feb 22
    Bon travail. Je nettoie les citations et j'envoie à la mise en page.

    ~ delay_next(0)
    # date:-3
    # type:received
    # speaker:Pat
    # time:Mar 1
    J'ai un tuyau sur les allocations budgétaires de l'autorité portuaire pour le nouveau terminal. Garde l'oreille ouverte.

    ~ delay_next(0)
    # type:sent
    # time:Mar 1
    Compris. Une idée du calendrier ?

    ~ delay_next(0)
    # type:received
    # speaker:Pat
    # time:Mar 1
    Ma source dit dans les prochaines semaines. Ne cours pas après pour l'instant — sois juste prêt.

    ~ delay_next(0)
    # date:-1
    # type:received
    # speaker:Pat
    # time:Mar 12
    Conférence de presse demain matin sur l'accord {name("aricanga", "short")}. Le ministère est resté discret. Vas-y, prends des notes, vois ce qu'ils disent vraiment.

    ~ delay_next(0)
    # type:sent
    # time:Mar 12
    J'y serai. Des éléments de contexte à revoir ?

    ~ delay_next(0)
    # type:received
    # speaker:Pat
    # time:Mar 12
    Juste les bases. Concession de 30 ans, Province Nord. La rédaction a besoin d'un papier rapide dans tous les cas.
}

# story_start

// Route to appropriate state
{not seen_announcement:
    -> pat_chat.waiting
}

{seen_announcement and not player_agreed:
    {pat_chat.ask_angle == 0: -> pat_chat.ask_angle}
}

{player_agreed and not draft_sent:
    -> pat_chat.waiting_for_draft
}

{draft_sent and not article_published:
    -> pat_chat.publishing
}

{article_published:
    -> pat_chat.post_publish
}

-> pat_chat.idle

= waiting
-> DONE

= ask_angle

{ask_angle > 1: -> choices}

# speaker:Pat
# type:received
# time:8:40 AM
J'ai vu la dépêche. Le ministre a mis le paquet — « investissement historique », 12 000 emplois. Le discours habituel.

~ delay_next(1200)
# speaker:Pat
# type:received
# label:pat-deadline
Il me faut quelque chose pour l'édition de ce soir. Quel angle tu envisages ?

- (choices)
* [Un compte-rendu classique. J'attends le dossier de presse du service com du ministère, je devrais l'avoir dans l'heure.]
    # type:sent
    # quoteRef:pat-deadline
    Un compte-rendu classique. J'attends le dossier de presse du service com du ministère, je devrais l'avoir dans l'heure.

    ~ player_agreed = true
    # targetChat:notes
    # type:sent
    # notificationPreview:Nouvelle mission : article {name("aricanga", "short")}
    Nouvelle mission de Pat : couvrir l'accord minier {name("aricanga", "short")}. Compte-rendu classique pour l'édition de ce soir.

    ~ delay_next(600)
    # speaker:Pat
    # type:received
    Bien. Envoie avant midi si tu peux. Je garde la page 3.

    ~ delay_next(400)
    # type:received
    Et essaie d'obtenir une citation du ministère. Même un « pas de commentaire » c'est quelque chose.

    // Jean-Marc envoie le dossier de presse après accord du joueur
    ~ delay_next(2000)
    # targetChat:attache
    # speaker:Jean-Marc
    # type:received
    # notificationPreview:Dossier de presse de la conférence de ce matin
    Bonjour. Comme promis, voici le dossier de presse de la conférence de ce matin.
    -> DONE

* [Quelque chose cloche dans les chiffres. Mais j'attends encore le dossier de presse — je veux d'abord voir ce qu'il contient.]
    # type:sent
    Quelque chose cloche dans les chiffres. Mais j'attends encore le dossier de presse — je veux d'abord voir ce qu'il contient.

    ~ delay_next(1500)
    # speaker:Pat
    # type:received
    Je t'entends, mais on n'a pas la marge pour une enquête approfondie maintenant.

    ~ delay_next(1000)
    # type:received
    Fais la version rapide aujourd'hui. S'il y a plus, on reprend la semaine prochaine.

    ~ delay_next(800)
    # type:received
    L'article sur l'autorité portuaire attend aussi.

    ~ delay_next(1200)
    # type:sent
    D'accord. Je récupère le dossier de presse et je passe quelques coups de fil.

    ~ player_agreed = true
    # targetChat:notes
    # type:sent
    # notificationPreview:Nouvelle mission : article {name("aricanga", "short")}
    Nouvelle mission de Pat : couvrir l'accord minier {name("aricanga", "short")}. Version rapide pour ce soir — à approfondir plus tard si nécessaire.

    // Jean-Marc envoie le dossier de presse après accord du joueur
    ~ delay_next(2000)
    # targetChat:attache
    # speaker:Jean-Marc
    # type:received
    # notificationPreview:Dossier de presse de la conférence de ce matin
    Bonjour. Comme promis, voici le dossier de presse de la conférence de ce matin.
    -> DONE

= waiting_for_draft
{not research_complete: -> DONE}
{waiting_for_draft > 1: -> waiting_for_draft.choice}

# speaker:Pat
# type:received
# time:12:00 PM
Où en es-tu avec l'article {name("aricanga", "short")} ? La rédaction en a besoin rapidement.

- (choice)
* [Voici le brouillon]
    # type:sent
    # time:12:15 PM
    # attachment:/assets/docs/aricanga-draft-v1.docx
    Brouillon en pièce jointe. Le ministère reste muet comme d'habitude.

    ~ draft_sent = true
    -> pat_chat.draft_confirmed

= draft_confirmed
// Changement météo : nuages l'après-midi
~ delay_next(2500)
# status:weather:cloudy
# status:temperature:24°C

# speaker:Pat
# type:received
# time:1:30 PM
Bon travail. Ça passe ce soir, page 3.

~ delay_next(800)
# type:received
Fais une pause, puis attaque les documents de l'autorité portuaire. Ils viennent d'arriver.

# targetChat:notes
# type:sent
# notificationPreview:Notes du brouillon à revoir
C'est le moment de réfléchir à l'article {name("aricanga", "short")} avant publication.
-> DONE

= publishing
~ article_published = true

# speaker:Pat
# type:received
# time:5:15 PM
L'article est en ligne. Déjà des réactions.

~ delay_next(1000)
# type:received
Bon travail dans un délai serré.

~ delay_next(4000)

# targetChat:spectre
# speaker:TonyGov
# type:received
# time:5:30 PM
# presence:online
# notificationPreview:J'ai lu votre article sur l'accord {name("aricanga", "short")}.
J'ai lu votre article sur l'accord {name("aricanga", "short")}.

# targetChat:activist
# speaker:{name("activist", "first_name")}
# type:received
# time:5:35 PM
# notificationPreview:J'ai vu votre article...
J'ai vu votre article sur {name("aricanga", "short")}.
{activist_comment_requested:
    ~ activist_responded = true
}

// Trigger Attaché - réaction positive à l'article
~ delay_next(5000)
# targetChat:attache
# speaker:Jean-Marc
# type:received
# time:5:40 PM
# notificationPreview:Je viens de voir votre article.
Je viens de voir votre article. Bien écrit.
-> DONE

= post_publish
# speaker:Pat
# type:received
# time:5:45 PM
Les documents de l'autorité portuaire sont dans ta boîte mail. Allocations budgétaires pour le nouveau terminal.

~ delay_next(600)
# type:received
Dis-moi quand tu les auras regardés. Il pourrait y avoir quelque chose.
-> DONE

= idle
-> DONE
