// Fil Info Gouv - Annonces officielles

=== news_chat ===
~ current_chat = "news"

// Seed messages - generated on first visit, persisted in message history
// Time tags here are display-only (before # story_start)
{news_chat == 1:
    # type:received
    # speaker:Gov News Wire
    # time:Feb 20
    Le ministère des Finances publie le rapport fiscal du T4. Les revenus du secteur extractif en hausse de 3,2 % sur un an, portés par les exportations de cuivre et de cobalt. Le rapport souligne une augmentation de 15 % des recettes non fiscales issues des licences minières, tout en notant que les dépenses d'infrastructure dans les régions productrices restent en deçà de l'objectif de 8 % fixé par le Plan national de développement. L'opposition parlementaire a demandé un audit indépendant des versements de redevances aux gouvernements provinciaux.

    ~ delay_next(0)
    # type:received
    # speaker:Gov News Wire
    # time:Feb 28
    Décaissement du fonds d'infrastructure de la Province Nord prévu pour mars. Le ministère des Travaux publics confirme la liste restreinte des entrepreneurs.

    ~ delay_next(0)
    # type:received
    # speaker:Gov News Wire
    # time:Mar 5
    La commission sénatoriale approuve le code minier amendé par 42 voix contre 17. De nouvelles dispositions exigent une divulgation renforcée pour les titulaires de concessions, incluant des rapports de production trimestriels et la transparence sur les bénéficiaires effectifs. Les groupes environnementaux ont salué l'inclusion de garanties de réhabilitation obligatoires, bien que les représentants de l'industrie aient averti que le calendrier de mise en conformité pourrait décourager les nouveaux investissements. Le code amendé entre en vigueur dans 90 jours sous réserve de la signature présidentielle.

    ~ delay_next(0)
    # type:received
    # speaker:Gov News Wire
    # time:Mar 10
    La délégation commerciale de la province voisine conclut une visite de trois jours. Un communiqué conjoint sur le corridor transfrontalier des ressources est attendu cette semaine.
}

# story_start

// Only show main content once
{news_chat > 1: -> DONE}

# speaker:Gov News Wire
# type:received
# time:8:35 AM
OFFICIEL — {name("ministry", "name")} confirme un partenariat minier de 30 ans avec {name("aricanga", "name")}. Communiqué complet à suivre.

// Signal dip while commuting
~ delay_next(400)
# status:signal:3

~ delay_next(600)
# type:received
L'accord accorde des ((droits d'extraction::glossary:extractive-industries)) exclusifs sur l'ensemble de {name("northern_province", "name")}. Le ministre de l'Énergie : « Ce partenariat représente un investissement historique pour l'avenir de notre nation — 12 000 emplois et un revenu annuel estimé à 450 millions de dollars. »

~ delay_next(400)
# status:signal:4

~ delay_next(800)
# type:received
((Redevances::glossary:royalties)) fixées à 5 % de la valeur brute de production. ((Paiements fiscaux::glossary:tax-payments)) structurés dans le cadre du code minier amendé.

~ delay_next(600)
# type:received
# image:/assets/press-release-aricanga.svg
Partenariat {name("aricanga", "name")} — Communiqué de presse officiel

-> DONE
