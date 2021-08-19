const Connection = require("tedious").Connection;
const Request = require("tedious").Request;
const TYPES = require("tedious").TYPES;

module.exports = function (context, req) {
  context.log("JavaScript HTTP trigger function processed a request.");

  const config = {
    server: process.env.DB_HOST, //update me
    authentication: {
      type: "default",
      options: {
        userName: process.env.DB_USERNAME, //update me
        password: process.env.DB_PASSWORD, //update me
      },
    },
    options: {
      // If you are on Microsoft Azure, you need encryption:
      encrypt: true,
      database: process.env.DB_NAME, //update me
    },
  };

  let jsonArray = [];
  let rowObject = {};

  const connection = new Connection(config);
  connection.on("connect", function (err) {
    context.log("Connected");
    let dbRequest = "";
    const { category, providerId, startDate, endDate } = req.body.input;
    if (startDate && endDate) {
      if (category) {
        if (providerId) {
          dbRequest = `SELECT * FROM RfqReporteAdjudicacion where RfqFechaCreacion between '${startDate}' and dateadd(DD, 1, '${endDate}') and ProveedorId = '${providerId}' and CategoriaNombre = '${category}' order by RfqFechaCreacion Asc;`;
        } else {
          dbRequest = `SELECT * FROM RfqReporteAdjudicacion where RfqFechaCreacion between '${startDate}' and dateadd(DD, 1, '${endDate}') and CategoriaNombre = '${category}' order by RfqFechaCreacion Asc;`;
          console.log(dbRequest);
        }
      } else {
        if (providerId) {
          dbRequest = `SELECT * FROM RfqReporteAdjudicacion where RfqFechaCreacion between '${startDate}' and dateadd(DD, 1, '${endDate}') and ProveedorId = '${providerId}' order by RfqFechaCreacion Asc;`;
        } else {
          dbRequest = `SELECT * FROM RfqReporteAdjudicacion where RfqFechaCreacion between '${startDate}' and dateadd(DD, 1, '${endDate}') order by RfqFechaCreacion Asc;`;
        }
      }
    }
    if (dbRequest !== "") {
      getData(dbRequest, providerId);
    } else {
      context.res = {
        status: 400,
        body: {
          message: "Se requiere especificar un intervalo de tiempo",
        },
      };
      context.done();
      connection.close();
    }
  });

  connection.connect();

  function getData(dbRequest, providerId) {
    request = new Request(dbRequest, function (err, rowCount, rows) {
      if (err) {
        console.log(err);
      }
    });

    if (!providerId) {
      request.on("row", function (columns) {
        columns.forEach(function (column) {
          let tempColName = column.metadata.colName;
          let tempColData = "";
          if (tempColName === "CompradorNombre") {
            tempColData = "Empresa Compradora";
          } else if (tempColName === "ProveedorNombre") {
            tempColData = "Empresa Proveedora";
          } else {
            tempColData = column.value;
          }
          rowObject[tempColName] = tempColData;
        });
        jsonArray.push(rowObject);
        rowObject = {};
      });
    } else {
      request.on("row", function (columns) {
        columns.forEach(function (column) {
          let tempColName = column.metadata.colName;
          let tempColData = column.value;
          rowObject[tempColName] = tempColData;
        });
        jsonArray.push(rowObject);
        rowObject = {};
      });
    }

    request.on("done", function (rowCount, more) {
      console.log(rowCount + " rows returned");
    });

    // Close the connection after the final event emitted by the request, after the callback passes
    request.on("requestCompleted", function (rowCount, more) {
      context.res = {
        status: 200,
        body: jsonArray,
      };
      context.done();
      connection.close();
    });
    connection.execSql(request);
  }
};
