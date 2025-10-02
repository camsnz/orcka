plugins {
    application
    java
}

repositories {
    mavenCentral()
}

dependencies {
    implementation("com.sparkjava:spark-core:2.9.4")
    implementation("com.google.code.gson:gson:2.11.0")
    implementation("org.slf4j:slf4j-simple:2.0.16")

    testImplementation(platform("org.junit:junit-bom:5.11.4"))
    testImplementation("org.junit.jupiter:junit-jupiter")
}

application {
    mainClass.set("com.orcka.audit.AuditEngineApplication")
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

tasks.withType<Test> {
    useJUnitPlatform()
}

// Ensure reproducible builds for the demonstration Docker image
tasks.withType<Jar> {
    isPreserveFileTimestamps = false
    isReproducibleFileOrder = true
}
