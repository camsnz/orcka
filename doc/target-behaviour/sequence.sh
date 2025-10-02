## Below is how these scripts have worked together
## in another project.
## They represent the combined behaviour intended
## for the orcka tool.



# check for docker buildx/bake, and containerd
./ci/cmd/check-docker-versions.sh
# precalculate base image tags
./ci/cmd/orcka.cjs calculate --file ci/docker/docker-sha.yaml
# build all images
./ci/cmd/bake-for-target.sh --env local \
					        --options "${BUILD_OPTIONAL} \
							--file docker-bake.sha.hcl \
							--allow=fs.read=../q"
# self-describe image inheritance
./ci/cmd/print-baked-tree.sh
