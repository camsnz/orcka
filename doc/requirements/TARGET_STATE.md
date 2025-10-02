
### Unfulfilled needs
 - when running build, targets named in docker-compose should get two tags:
    1. the calculated orcka tag
    2. their 'target' tag. This will be one of several potential tag sources.
        - docker-compose.yml, service.image can have a `:tagvalue` or `:${ENV_VAR-defaultValue}` or nothing (`latest`).
        - the target should be resolved based on the results of whatever compose file merging has taken place, as this may override the original compose file image tag value.
    - these additional tags should be included in the build plan line items
 - the list of docker registry / ecr locations of all named images should be collected into a list.
    - this registry list will be part of the build plan, listing the registry name and, if we have this information:
        - number of images associated with that registry with the counts as (local/total) with the local number in green.
        - total size in GB (if it's possible to have that information) as (local GB/total GB)
 - when printing the build summary table that has 'runtime local server', change it to 'container local remote', and compact the columns for those letters to one char wide, it can just be 'CLR' as a heading with the status emojis underneath in each row.
 - when performing an `orcka run`, a stat is performed and build status is assessed. If we lack images locally, the images will need to be 'baked', where docker bake can do any layer pulls that are essential.
 - when performing an `orcka run`, a run plan should be printed, clarifying which services are planned to run (this will not be a full list of targets as orcka build / docker bake knows it, just the composed services, networks and volumes).
    - this plan will also include and detail which services are already running, clarifying distinction between images and services / containers.
