exports.up = function (knex) {
    return knex.schema.createTable("quiet_hours", function (table) {
        table.increments("id").primary();
        table.integer("monitor_id").unsigned().notNullable()
            .references("id").inTable("monitor")
            .onDelete("CASCADE");
        table.string("start_time", 5).notNullable(); // HH:mm format
        table.string("end_time", 5).notNullable();   // HH:mm format
        table.string("timezone", 100).notNullable();
        table.text("weekdays").notNullable().defaultTo("[]"); // JSON array [1,2,3,4,5,6,7]
        table.boolean("active").notNullable().defaultTo(true);
    });
};

exports.down = function (knex) {
    return knex.schema.dropTable("quiet_hours");
};
