import { getConnection } from "./database/connection.mjs";

export default async function (context, req) {
  //startDate and endDate are mandatory
  //rowsPerPage and page are mandatory for pagination
  const { category, providerId, startDate, endDate, rowsPerPage, page } =
    req.body.input;

  if (!startDate ^ !endDate || (!startDate && !endDate)) {
    context.res = {
      status: 400,
      body: { message: "startDate, endDate query attributes are missing" },
    };
    context.done();
    return;
  }

  if (!rowsPerPage ^ !page) {
    context.res = {
      status: 400,
      body: { message: "rowsPerPage, page are required for pagination" },
    };
    context.done();
    return;
  }

  let pagination = rowsPerPage && page;
  //It is required to build two different sql queries, the first one which brings the required data
  //and the second one which count the total number of rows for the given parameters
  let sqlQuery = `SELECT 
  CategoriaId,
  CategoriaNombre,
  CompradorId,
  CompradorNombre${!providerId ? "='Empresa Compradora'" : ""},
  CompradorRut,
  CreatedDate,
  Fuente,
  Id, 
  ItemCantidad, 
  ItemDescripcion, 
  ItemPosicion, 
  ProveedorId,
  ProveedorNombre${!providerId ? "='Empresa Proveedora'" : ""},
  ProveedorRealizaOferta,
  ProveedorRespuestaInvitacion,
  ProveedorRut,
  ProveedorUsuarioRealizaOferta,
  RfqAdjudicada,
  RfqCantidadOferta,
  RfqComentarios,
  RfqDescripcion, 
  RfqEstado, 
  RfqFechaCierre,
  RfqFechaCreacion,
  RfqFechaPublicacion, 
  RfqId,
  RfqMoneda,
  RfqNombre, 
  RfqNumero, 
  RfqPrecio,
  RfqRazonRechazo,
  RfqUsuarioCreador,
  UserId `;
  if (rowsPerPage && page) {
    let rowCounterQuery = "SELECT count(Id) as total ";
  }

  const sqlQueryOptions = {
    date: `FROM RfqReporteAdjudicacion where RfqFechaCreacion between '${startDate}' and dateadd(DD, 1, '${endDate}')`,
    providerId: ` and ProveedorId = '${providerId}'`,
    category: ` and CategoriaNombre = '${category}'`,
    orderBy: " order by RfqFechaCreacion Asc",
    pagination: pagination
      ? ` offset ${
          (+page - 1) * +rowsPerPage
        } Rows fetch next ${rowsPerPage} rows only;`
      : null,
  };
  //Add the date sql part
  sqlQuery += sqlQueryOptions.date;
  if (pagination) {
    rowCounterQuery += sqlQueryOptions.date;
  }
  //Add the provider sql part if necessary
  // sqlQuery = providerId ? sqlQuery + sqlQueryOptions.providerId : sqlQuery;
  if (providerId) {
    sqlQuery += sqlQueryOptions.providerId;
    if (pagination) {
      rowCounterQuery += sqlQueryOptions.providerId;
    }
  }
  //Add the category sql part if necessary
  // sqlQuery = category ? sqlQuery + sqlQueryOptions.category : sqlQuery;
  if (category) {
    sqlQuery += sqlQueryOptions.category;
    if (pagination) {
      rowCounterQuery += sqlQueryOptions.category;
    }
  }

  //Close the rowCounterQuery
  if (pagination) {
    rowCounterQuery += ";";
  }
  //Add the order by and pagination sql part
  sqlQuery += sqlQueryOptions.orderBy;
  sqlQuery += pagination ? sqlQueryOptions.pagination : ";";
  // context.log(sqlQuery);
  // context.log(rowCounterQuery);

  let response1;
  let response2 = {};
  try {
    const pool = await getConnection();
    let sqlQueryResult = await pool.request().query(sqlQuery);
    if (pagination) {
      let sqlTotalRowsResult = await pool.request().query(rowCounterQuery);
    }
    if (pagination) {
      let totalRows = sqlTotalRowsResult.recordset[0].total;
    }

    response1 = {
      result: sqlQueryResult.recordset,
    };
    if (pagination) {
      response2 = {
        totalRows: totalRows,
        hasNextPage: +page * +rowsPerPage < totalRows,
        hasPreviousPage: +page > 1,
        currentPage: +page,
        nextPage: +page + 1,
        previousPage: +page - 1,
        lastPage: Math.ceil(totalRows / +rowsPerPage),
      };
    }
  } catch (err) {
    context.log.error("ERROR", err);
    // This rethrown exception will be handled by the Functions Runtime and will only fail the individual invocation
    throw err;
  }

  context.res = {
    status: 200,
    body: pagination ? { ...response1, ...response2 } : response1.result,
  };
  context.done();
}
